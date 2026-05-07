(function () {
  const avatarOptions = [
    "/avatars/avatar-01.svg",
    "/avatars/avatar-02.svg",
    "/avatars/avatar-03.svg",
    "/avatars/avatar-04.svg",
    "/avatars/avatar-05.svg",
    "/avatars/avatar-06.svg"
  ];
  const avatarUploadTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const maxAvatarUploadSize = 5 * 1024 * 1024;
  const avatarOutputSize = 220;
  const avatarOutputQuality = 0.84;
  const maxAvatarDataUrlLength = 320000;
  const themeStorageKey = "cicbet.theme";

  const state = {
    config: null,
    session: loadSession(),
    users: [],
    characters: [],
    bets: [],
    betOptions: [],
    predictions: [],
    combos: [],
    comboLegs: [],
    currentView: resolveInitialView(),
    theme: loadThemePreference()
  };

  const dom = {
    configAlert: document.getElementById("config-alert"),
    globalFeedback: document.getElementById("global-feedback"),
    adminBetsNav: document.getElementById("admin-bets-nav"),
    adminResolveNav: document.getElementById("admin-resolve-nav"),
    betsNav: document.getElementById("bets-nav"),
    registerNav: document.getElementById("register-nav"),
    themeToggleButton: document.getElementById("theme-toggle-button"),
    loginNav: document.getElementById("login-nav"),
    logoutButton: document.getElementById("logout-button"),
    summaryGrid: document.getElementById("summary-grid"),
    homeBetsList: document.getElementById("home-bets-list"),
    playersRanking: document.getElementById("players-ranking"),
    betsRanking: document.getElementById("bets-ranking"),
    loginForm: document.getElementById("login-form"),
    loginEmail: document.getElementById("login-email"),
    loginPassword: document.getElementById("login-password"),
    registerForm: document.getElementById("register-form"),
    registerName: document.getElementById("register-name"),
    registerEmail: document.getElementById("register-email"),
    registerPassword: document.getElementById("register-password"),
    registerPasswordConfirm: document.getElementById("register-password-confirm"),
    registerCharacter: document.getElementById("register-character"),
    registerBalance: document.getElementById("register-balance"),
    avatarPicker: document.getElementById("avatar-picker"),
    registerAvatarUpload: document.getElementById("register-avatar-upload"),
    avatarUploadButton: document.getElementById("avatar-upload-button"),
    avatarResetButton: document.getElementById("avatar-reset-button"),
    avatarUploadHint: document.getElementById("avatar-upload-hint"),
    charactersGallery: document.getElementById("characters-gallery"),
    bettingSessionCard: document.getElementById("betting-session-card"),
    betEntryList: document.getElementById("bet-entry-list"),
    adminBetsAccess: document.getElementById("admin-bets-access"),
    adminBetsDeleteList: document.getElementById("admin-bets-delete-list"),
    adminResolveList: document.getElementById("admin-resolve-list"),
    adminBetForm: document.getElementById("admin-bet-form"),
    betTitle: document.getElementById("bet-title"),
    betClosesAt: document.getElementById("bet-closes-at"),
    betDescription: document.getElementById("bet-description"),
    betMultiplier: document.getElementById("bet-multiplier"),
    navLinks: Array.from(document.querySelectorAll("[data-view-target]")),
    viewPanels: Array.from(document.querySelectorAll("[data-view]"))
  };

  let selectedAvatar = avatarOptions[0];

  applyTheme(state.theme, false);
  bindEvents();
  setActiveView(state.currentView);
  init();

  async function init() {
    setFeedback("Carregando dados do banco SQLite local...", "info");

    try {
      state.config = await fetchJson("/api/config");
      await refreshData();
      setFeedback("Dados carregados com sucesso no SQLite.", "success", true);
    } catch (error) {
      console.error(error);
      showConfigError(error.message || "Nao foi possivel iniciar a aplicacao local.");
      clearFeedback();
    }
  }

  function bindEvents() {
    dom.navLinks.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveView(button.dataset.viewTarget);
      });
    });

    dom.logoutButton.addEventListener("click", logout);
    dom.themeToggleButton.addEventListener("click", toggleTheme);
    dom.loginForm.addEventListener("submit", handleLoginSubmit);
    dom.registerForm.addEventListener("submit", handleRegisterSubmit);
    dom.registerAvatarUpload.addEventListener("change", handleAvatarUploadChange);
    dom.avatarUploadButton.addEventListener("click", () => {
      dom.registerAvatarUpload.click();
    });
    dom.avatarResetButton.addEventListener("click", () => {
      resetAvatarSelection();
    });
    dom.betEntryList.addEventListener("submit", handleBetEntrySubmit);
    dom.adminBetForm.addEventListener("submit", handleAdminBetSubmit);
    dom.adminBetsDeleteList.addEventListener("submit", handleAdminBetDelete);
    dom.adminResolveList.addEventListener("submit", handleAdminResolveSubmit);
    window.addEventListener("hashchange", () => {
      setActiveView(resolveInitialView());
    });
  }

  async function refreshData() {
    setFeedback("Atualizando dados do banco SQLite local...", "info");

    try {
      const data = await fetchJson("/api/bootstrap");
      state.characters = data.characters || [];
      state.users = data.users || [];
      state.bets = data.bets || [];
      state.betOptions = data.betOptions || [];
      state.predictions = data.predictions || [];
      state.combos = data.combos || [];
      state.comboLegs = data.comboLegs || [];
      syncSessionUser();
      renderAll();
    } catch (error) {
      clearFeedback();
      throw new Error("Nao foi possivel carregar os dados do banco SQLite local. Verifique o caminho em SQLITE_PATH e as permissoes de escrita.");
    }
  }

  function renderAll() {
    renderSessionNav();
    renderSummary();
    renderHomeBets();
    renderPlayersRanking();
    renderBetsRanking();
    renderCharacterOptions();
    renderAvatarPicker();
    renderCharactersGallery();
    renderBettingSessionCard();
    renderBetEntryList();
    renderAdminBetAccess();
    renderAdminBetDeleteList();
    renderAdminResolveList();
  }

  function renderSessionNav() {
    const currentUser = getCurrentUser();
    const isLoggedIn = Boolean(currentUser);

    dom.betsNav.classList.toggle("hidden", !isLoggedIn);
    dom.registerNav.classList.toggle("hidden", isLoggedIn);
    dom.loginNav.classList.toggle("hidden", isLoggedIn);
    dom.logoutButton.classList.toggle("hidden", !isLoggedIn);
    renderThemeToggleButton();
  }

  function renderSummary() {
    const openBets = getOpenBets();
    const totalVolume = state.predictions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const leader = getLeaderboardRows()[0];
    const currentUser = getCurrentUser();
    const currentStats = currentUser ? getUserStats(currentUser) : null;

    const items = [
      {
        label: "Apostas ativas",
        value: String(openBets.length),
        helper: "Mercados ainda abertos para entrada"
      },
      {
        label: "Jogadores",
        value: String(state.users.length),
        helper: "Cadastros salvos no banco"
      },
      {
        label: "Volume apostado",
        value: `${formatPoints(totalVolume)} pts`,
        helper: "Soma das apostas registradas"
      },
      {
        label: currentUser ? "Meu saldo" : "Lider atual",
        value: currentUser ? `${formatPoints(currentStats.balance)} pts` : escapeHtml(leader?.user.name || "Sem dados"),
        helper: currentUser
          ? "Atualizado com base nas suas entradas"
          : leader
            ? `${formatPoints(leader.stats.balance)} pts acumulados`
            : "Ainda nao ha jogadores no ranking"
      }
    ];

    dom.summaryGrid.innerHTML = items
      .map(
        (item) => `
          <article class="summary-card">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <small>${escapeHtml(item.helper)}</small>
          </article>
        `
      )
      .join("");
  }

  function renderHomeBets() {
    const featuredBets = state.bets
      .filter((bet) => bet.status !== "cancelled")
      .sort((a, b) => {
        const aOpen = a.status === "open" ? 1 : 0;
        const bOpen = b.status === "open" ? 1 : 0;

        if (aOpen !== bOpen) {
          return bOpen - aOpen;
        }

        return new Date(b.closes_at) - new Date(a.closes_at);
      });

    if (!featuredBets.length) {
      dom.homeBetsList.innerHTML = emptyState("Nenhuma aposta cadastrada no momento.");
      return;
    }

    dom.homeBetsList.innerHTML = featuredBets
      .slice(0, 8)
      .map((bet) => {
        const totalEntries = getPredictionsForBet(bet.id).length;
        const status = getBetStatusLabel(bet);
        const winnerNames = getWinningUserNamesForBet(bet.id);
        return `
          <article class="bet-card compact">
            <div class="bet-card-top">
              <div>
                <span class="chip ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
                <h3>${escapeHtml(bet.title)}</h3>
              </div>
              <strong class="odds-badge">${Number(bet.base_multiplier).toFixed(2)}x</strong>
            </div>
            <p>${escapeHtml(bet.description || "Sem descricao cadastrada.")}</p>
            <div class="bet-meta">
              <span>${bet.status === "settled" ? "Resolvida em" : "Fecha em"} ${escapeHtml(formatDateTime(bet.closes_at))}</span>
              <span>${totalEntries} entrada(s)</span>
              ${
                bet.status === "settled"
                  ? `<span>${
                      winnerNames.length
                        ? `${winnerNames.length > 1 ? "Ganhadores" : "Ganhador"}: ${escapeHtml(winnerNames.join(", "))}`
                        : "Sem vencedor registrado"
                    }</span>`
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPlayersRanking() {
    const rows = getLeaderboardRows();

    if (!rows.length) {
      dom.playersRanking.innerHTML = emptyState("Sem jogadores cadastrados.");
      return;
    }

    dom.playersRanking.innerHTML = `
      <div class="table-head players">
        <span>#</span>
        <span>Jogador</span>
        <span>Personagem</span>
        <span>Saldo</span>
      </div>
      ${rows
        .slice(0, 10)
        .map((row, index) => {
          return `
            <div class="table-row players">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(row.user.name)}</strong>
                <small>${escapeHtml(row.user.email)}</small>
              </div>
              <span>${escapeHtml(row.character?.name || "-")}</span>
              <span>${formatPoints(row.stats.balance)} pts</span>
            </div>
          `;
        })
        .join("")}
    `;
  }

  function renderBetsRanking() {
    const rows = state.bets
      .map((bet) => {
        const entries = getPredictionsForBet(bet.id);
        const volume = entries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        return {
          bet,
          entries: entries.length,
          volume
        };
      })
      .sort((a, b) => b.volume - a.volume);

    if (!rows.length) {
      dom.betsRanking.innerHTML = emptyState("Sem apostas registradas.");
      return;
    }

    dom.betsRanking.innerHTML = `
      <div class="table-head bets">
        <span>#</span>
        <span>Aposta</span>
        <span>Status</span>
        <span>Volume</span>
      </div>
      ${rows
        .slice(0, 10)
        .map((row, index) => {
          const status = getBetStatusLabel(row.bet);
          return `
            <div class="table-row bets">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(row.bet.title)}</strong>
                <small>${row.entries} entrada(s)</small>
              </div>
              <span class="chip ${status.className}">${escapeHtml(status.label)}</span>
              <span>${formatPoints(row.volume)} pts</span>
            </div>
          `;
        })
        .join("")}
    `;
  }

  function renderCharacterOptions() {
    if (!state.characters.length) {
      dom.registerCharacter.innerHTML = `<option value="">Nenhum personagem carregado</option>`;
      dom.registerCharacter.disabled = true;
      return;
    }

    dom.registerCharacter.disabled = false;
    dom.registerCharacter.innerHTML = state.characters
      .map((character) => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)}</option>`)
      .join("");
  }

  function renderAvatarPicker() {
    const customSelected = isCustomAvatar(selectedAvatar);
    dom.avatarPicker.innerHTML = [
      ...avatarOptions.map((avatar) => {
        const activeClass = avatar === selectedAvatar ? "active" : "";
        return `
          <button class="avatar-option ${activeClass}" type="button" data-avatar="${escapeHtml(avatar)}">
            <img src="${escapeHtml(avatar)}" alt="Avatar da arena" />
          </button>
        `;
      }),
      `
        <button class="avatar-option avatar-option-custom ${customSelected ? "active" : ""}" type="button" data-avatar-custom>
          ${
            customSelected
              ? `<img src="${escapeHtml(selectedAvatar)}" alt="Sua foto personalizada" />`
              : '<span class="avatar-custom-mark">+</span>'
          }
          <strong>${customSelected ? "Sua foto" : "Foto propria"}</strong>
        </button>
      `
    ].join("");

    dom.avatarPicker.querySelectorAll("[data-avatar]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedAvatar = button.dataset.avatar;
        renderAvatarPicker();
      });
    });

    dom.avatarPicker.querySelector("[data-avatar-custom]")?.addEventListener("click", () => {
      dom.registerAvatarUpload.click();
    });

    renderAvatarUploadState();
  }

  function renderCharactersGallery() {
    if (!state.characters.length) {
      dom.charactersGallery.innerHTML = emptyState("Nenhum personagem foi encontrado no banco.");
      return;
    }

    dom.charactersGallery.innerHTML = state.characters
      .map(
        (character) => `
          <article class="character-card" style="--character-accent: ${escapeHtml(character.accent_color || "#8b5cf6")}">
            <img src="${escapeHtml(character.image_url)}" alt="${escapeHtml(character.name)}" />
            <div class="character-card-head">
              <strong>${escapeHtml(character.name)}</strong>
              <small>${escapeHtml(formatCharacterCodename(character.slug))}</small>
            </div>
            <p>${escapeHtml(character.description || "Sem descricao.")}</p>
          </article>
        `
      )
      .join("");
  }

  function renderBettingSessionCard() {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      dom.logoutButton.classList.add("hidden");
      dom.bettingSessionCard.innerHTML = emptyState("Entre ou crie seu cadastro antes de registrar uma aposta.");
      return;
    }

    dom.logoutButton.classList.remove("hidden");
    const character = getCharacter(currentUser.character_id);
    const stats = getUserStats(currentUser);

    dom.bettingSessionCard.innerHTML = `
      <div class="session-user">
        <img class="session-avatar" src="${escapeHtml(currentUser.avatar_url || character?.image_url || avatarOptions[0])}" alt="${escapeHtml(currentUser.name)}" />
        <div>
          <strong>${escapeHtml(currentUser.name)}</strong>
          <small>${escapeHtml(currentUser.email)}</small>
          <p>${escapeHtml(character?.name || "Sem personagem selecionado")}</p>
        </div>
        <div class="session-balance">${formatPoints(stats.balance)} pts</div>
      </div>
    `;
  }

  function renderBetEntryList() {
    const currentUser = getCurrentUser();
    const openBets = getOpenBets();

    if (!currentUser) {
      dom.betEntryList.innerHTML = emptyState("Faca login na pagina Cadastro para apostar.");
      return;
    }

    if (!openBets.length) {
      dom.betEntryList.innerHTML = emptyState("Nao ha apostas abertas para registrar agora.");
      return;
    }

    dom.betEntryList.innerHTML = openBets
      .map((bet) => {
        const userPrediction = getPredictionsForUser(currentUser.id).find((prediction) => prediction.bet_id === bet.id);
        const hasPrediction = Boolean(userPrediction);
        return `
          <article class="bet-card">
            <div class="bet-card-top">
              <div>
                <span class="chip chip-open">Aberta</span>
                <h3>${escapeHtml(bet.title)}</h3>
              </div>
              <strong class="odds-badge">${Number(bet.base_multiplier).toFixed(2)}x</strong>
            </div>
            <p>${escapeHtml(bet.description || "Sem descricao cadastrada.")}</p>
            <div class="bet-meta">
              <span>Fecha em ${escapeHtml(formatDateTime(bet.closes_at))}</span>
              <span>${hasPrediction ? "Sua aposta ja foi registrada" : "Voce ainda nao apostou"}</span>
            </div>
            ${
              hasPrediction
                ? `<div class="info-note">${escapeHtml(buildPredictionSummary(userPrediction))}</div>`
                : `
                  <form class="bet-form" data-bet-form data-bet-id="${escapeHtml(bet.id)}">
                    <label>
                      <span>Valor do palpite</span>
                      <input name="predicted_value" type="text" placeholder="Ex: 3x1, 42, Time A" required />
                    </label>
                    <label>
                      <span>CIC-points</span>
                      <input name="amount" type="number" min="10" value="50" required />
                    </label>
                    <button class="primary-button" type="submit">Registrar aposta</button>
                  </form>
                `
            }
          </article>
        `;
      })
      .join("");
  }

  function renderAdminBetAccess() {
    const currentUser = getCurrentUser();
    const isAdminUser = currentUser ? isAdmin(currentUser) : false;

    dom.adminBetsNav.classList.toggle("hidden", !isAdminUser);
    dom.adminResolveNav.classList.toggle("hidden", !isAdminUser);
    dom.adminBetForm.classList.toggle("hidden", !isAdminUser);

    if (!currentUser) {
      dom.adminBetsAccess.innerHTML = emptyState("Entre com um usuario administrador para cadastrar apostas.");
      return;
    }

    if (!isAdminUser) {
      dom.adminBetsAccess.innerHTML = emptyState("Esta pagina e exclusiva para administradores.");
      if (state.currentView === "nova-aposta") {
        setActiveView("home");
      }
      return;
    }

    dom.adminBetsAccess.innerHTML = `
      <div class="session-user">
        <div>
          <strong>${escapeHtml(currentUser.name)}</strong>
          <small>${escapeHtml(currentUser.email)}</small>
          <p>Perfil com permissao para cadastrar novas apostas.</p>
        </div>
      </div>
    `;
  }

  function renderAdminBetDeleteList() {
    const currentUser = getCurrentUser();
    const openBets = getOpenBets();

    if (!currentUser || !isAdmin(currentUser)) {
      dom.adminBetsDeleteList.innerHTML = emptyState("A lista de exclusao aparece apenas para administradores.");
      return;
    }

    if (!openBets.length) {
      dom.adminBetsDeleteList.innerHTML = emptyState("Nao ha apostas vigentes para excluir.");
      return;
    }

    dom.adminBetsDeleteList.innerHTML = openBets
      .map((bet) => {
        const entryCount = getPredictionsForBet(bet.id).length;
        const comboCount = state.comboLegs.filter((leg) => leg.bet_id === bet.id).map((leg) => leg.combo_id).filter(Boolean)
          .filter((comboId, index, list) => list.indexOf(comboId) === index).length;

        return `
          <article class="bet-card compact">
            <div class="bet-card-top">
              <div>
                <span class="chip chip-open">Vigente</span>
                <h3>${escapeHtml(bet.title)}</h3>
              </div>
              <strong class="odds-badge">${Number(bet.base_multiplier).toFixed(2)}x</strong>
            </div>
            <p>${escapeHtml(bet.description || "Sem descricao cadastrada.")}</p>
            <div class="bet-meta">
              <span>${entryCount} aposta(s) vinculada(s)</span>
              <span>${comboCount} combo(s) afetado(s)</span>
            </div>
            <form data-delete-bet-form data-bet-id="${escapeHtml(bet.id)}">
              <button class="danger-button" type="submit">Excluir aposta</button>
            </form>
          </article>
        `;
      })
      .join("");
  }

  function renderAdminResolveList() {
    const currentUser = getCurrentUser();
    const activeBets = state.bets.filter((bet) => bet.status === "open");

    if (!currentUser || !isAdmin(currentUser)) {
      dom.adminResolveList.innerHTML = emptyState("A resolucao de apostas aparece apenas para administradores.");
      return;
    }

    if (!activeBets.length) {
      dom.adminResolveList.innerHTML = emptyState("Nao ha apostas ativas para resolver.");
      return;
    }

    dom.adminResolveList.innerHTML = activeBets
      .map((bet) => {
        const predictions = getPredictionsForBet(bet.id);

        return `
          <article class="bet-card compact">
            <div class="bet-card-top">
              <div>
                <span class="chip ${new Date(bet.closes_at) <= new Date() ? "chip-soon" : "chip-open"}">
                  ${new Date(bet.closes_at) <= new Date() ? "Fechada para entrada" : "Ainda aberta"}
                </span>
                <h3>${escapeHtml(bet.title)}</h3>
              </div>
              <strong class="odds-badge">${Number(bet.base_multiplier).toFixed(2)}x</strong>
            </div>
            <p>${escapeHtml(bet.description || "Sem descricao cadastrada.")}</p>
            <div class="bet-meta">
              <span>${predictions.length} aposta(s) registrada(s)</span>
              <span>Fecha em ${escapeHtml(formatDateTime(bet.closes_at))}</span>
            </div>
            <form class="form-stack" data-resolve-form data-bet-id="${escapeHtml(bet.id)}">
              <div class="resolve-list">
                ${
                  predictions.length
                    ? predictions
                        .map((prediction) => {
                          const user = state.users.find((item) => item.id === prediction.user_id);
                          const payout = calculatePredictionPayout(prediction);
                          return `
                            <label class="resolve-item">
                              <input type="checkbox" name="winner_prediction_ids" value="${escapeHtml(prediction.id)}" />
                              <span>
                                <strong>${escapeHtml(user?.name || "Usuario")}</strong>
                                <small>Palpite: ${escapeHtml(prediction.predicted_value || "Sem palpite informado")}</small>
                                <small>Apostou ${formatPoints(prediction.amount)} pts</small>
                                <small>Recebe ${formatPoints(payout)} pts se vencer</small>
                              </span>
                            </label>
                          `;
                        })
                        .join("")
                    : '<div class="empty-state">Nao ha apostas registradas para esta aposta.</div>'
                }
              </div>
              <button class="primary-button" type="submit" ${predictions.length ? "" : "disabled"}>Registrar resultado</button>
            </form>
          </article>
        `;
      })
      .join("");
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const email = dom.loginEmail.value.trim().toLowerCase();
    const password = dom.loginPassword.value;

    if (!email) {
      setFeedback("Informe um email valido.", "error");
      return;
    }

    if (!password) {
      setFeedback("Informe sua senha.", "error");
      return;
    }

    try {
      const result = await fetchJson("/api/auth-login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      state.session = {
        userId: result.user.id,
        email: result.user.email
      };
      persistSession(state.session);
      dom.loginForm.reset();
      await refreshData();
      setFeedback(`Sessao iniciada para ${result.user.name}.`, "success", true);
      setActiveView("apostas");
    } catch (error) {
      setFeedback(error.message, "error");
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();

    const name = dom.registerName.value.trim();
    const email = dom.registerEmail.value.trim().toLowerCase();
    const password = dom.registerPassword.value;
    const passwordConfirm = dom.registerPasswordConfirm.value;
    const characterId = dom.registerCharacter.value;
    const startingBalance = 1000;

    if (!name || !email || !characterId) {
      setFeedback("Preencha nome, email e personagem.", "error");
      return;
    }

    if (password.length < 4) {
      setFeedback("A senha deve ter pelo menos 4 caracteres.", "error");
      return;
    }

    if (password !== passwordConfirm) {
      setFeedback("A confirmacao de senha nao confere.", "error");
      return;
    }

    try {
      const result = await fetchJson("/api/auth-register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          avatarUrl: selectedAvatar,
          characterId,
          startingBalance
        })
      });

      state.session = {
        userId: result.user.id,
        email: result.user.email
      };
      persistSession(state.session);
      dom.registerForm.reset();
      dom.registerBalance.value = 1000;
      resetAvatarSelection();
      await refreshData();
      setFeedback("Cadastro criado com sucesso.", "success", true);
      setActiveView("apostas");
    } catch (error) {
      setFeedback(error.message, "error");
    }
  }

  async function handleAvatarUploadChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      validateAvatarFile(file);
      setFeedback("Ajustando foto para usar como avatar...", "info");
      selectedAvatar = await buildAvatarDataUrl(file);
      renderAvatarPicker();
      setFeedback("Foto personalizada pronta para o cadastro.", "success", true);
    } catch (error) {
      setFeedback(error.message || "Nao foi possivel carregar a foto escolhida.", "error");
    } finally {
      event.target.value = "";
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === "dark" ? "light" : "dark", true);
  }

  async function handleBetEntrySubmit(event) {
    const form = event.target.closest("[data-bet-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setFeedback("Entre primeiro para registrar sua aposta.", "error");
      return;
    }

    try {
      await fetchJson("/api/predictions-create", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          betId: form.dataset.betId,
          predictedValue: form.querySelector('[name="predicted_value"]').value.trim(),
          amount: Number(form.querySelector('[name="amount"]').value || 0)
        })
      });

      await refreshData();
      setFeedback("Aposta registrada com sucesso.", "success", true);
    } catch (error) {
      setFeedback(error.message, "error");
    }
  }

  async function handleAdminBetSubmit(event) {
    event.preventDefault();
    const currentUser = getCurrentUser();

    if (!currentUser || !isAdmin(currentUser)) {
      setFeedback("Apenas administradores podem cadastrar apostas.", "error");
      return;
    }

    const title = dom.betTitle.value.trim();
    const description = dom.betDescription.value.trim();
    const closesAtInput = dom.betClosesAt.value;
    const baseMultiplier = Number(dom.betMultiplier.value || 1.6);
    const closesAt = closesAtInput ? new Date(closesAtInput) : null;

    if (!title || !closesAt || Number.isNaN(closesAt.getTime())) {
      setFeedback("Preencha titulo e encerramento validos.", "error");
      return;
    }

    try {
      await fetchJson("/api/bets-create", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          title,
          description,
          closesAt: closesAt.toISOString(),
          baseMultiplier
        })
      });

      dom.adminBetForm.reset();
      dom.betMultiplier.value = 1.6;
      await refreshData();
      setFeedback("Aposta cadastrada com sucesso.", "success", true);
      setActiveView("home");
    } catch (error) {
      setFeedback(error.message, "error");
    }
  }

  async function handleAdminBetDelete(event) {
    const form = event.target.closest("[data-delete-bet-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const currentUser = getCurrentUser();

    if (!currentUser || !isAdmin(currentUser)) {
      setFeedback("Apenas administradores podem excluir apostas.", "error");
      return;
    }

    try {
      const result = await fetchJson("/api/bets-delete", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          betId: form.dataset.betId
        })
      });

      await refreshData();
      setFeedback(
        `Aposta excluida. ${result.deleted.affectedPredictions} entrada(s) e ${result.deleted.affectedCombos} combo(s) foram estornados.`,
        "success",
        true
      );
    } catch (error) {
      setFeedback(error.message, "error");
    }
  }

  async function handleAdminResolveSubmit(event) {
    const form = event.target.closest("[data-resolve-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const currentUser = getCurrentUser();

    if (!currentUser || !isAdmin(currentUser)) {
      setFeedback("Apenas administradores podem registrar resultados.", "error");
      return;
    }

    try {
      await fetchJson("/api/bets-resolve", {
        method: "POST",
        body: JSON.stringify({
          userId: currentUser.id,
          betId: form.dataset.betId,
          winnerPredictionIds: Array.from(form.querySelectorAll('[name="winner_prediction_ids"]:checked')).map(
            (input) => input.value
          )
        })
      });

      await refreshData();
      setFeedback("Vencedores registrados com sucesso.", "success", true);
    } catch (error) {
      setFeedback(error.message, "error");
    }
  }

  function setActiveView(view) {
    const allowedViews = new Set(["home", "entrar", "cadastro", "apostas", "nova-aposta", "resolver-apostas"]);
    state.currentView = allowedViews.has(view) ? view : "home";

    if (state.currentView === "entrar" && getCurrentUser()) {
      state.currentView = "home";
    }

    if (state.currentView === "apostas" && !getCurrentUser()) {
      state.currentView = "home";
    }

    if (state.currentView === "nova-aposta" || state.currentView === "resolver-apostas") {
      const currentUser = getCurrentUser();
      if (!currentUser || !isAdmin(currentUser)) {
        state.currentView = "home";
      }
    }

    dom.navLinks.forEach((button) => {
      button.classList.toggle("active", button.dataset.viewTarget === state.currentView);
    });

    dom.viewPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.view === state.currentView);
    });

    const hash = `#${state.currentView}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }

  function resolveInitialView() {
    const view = String(window.location.hash || "").replace("#", "");
    return view || "home";
  }

  function syncSessionUser() {
    if (!state.session?.userId) {
      return;
    }

    const user = state.users.find((item) => item.id === state.session.userId);
    if (!user) {
      clearSession();
      state.session = null;
      return;
    }

    state.session = {
      userId: user.id,
      email: user.email
    };
    persistSession(state.session);
  }

  function getCurrentUser() {
    if (!state.session?.userId) {
      return null;
    }

    return state.users.find((user) => user.id === state.session.userId) || null;
  }

  function getOpenBets() {
    return state.bets.filter((bet) => isBetOpen(bet));
  }

  function getCharacter(characterId) {
    return state.characters.find((character) => character.id === characterId) || null;
  }

  function getBet(betId) {
    return state.bets.find((bet) => bet.id === betId) || null;
  }

  function getPredictionsForBet(betId) {
    return state.predictions.filter((prediction) => prediction.bet_id === betId);
  }

  function getPredictionsForUser(userId) {
    return state.predictions.filter((prediction) => prediction.user_id === userId);
  }

  function getWinningUserNamesForBet(betId) {
    return getPredictionsForBet(betId)
      .filter((prediction) => prediction.is_correct === true)
      .map((prediction) => state.users.find((user) => user.id === prediction.user_id)?.name)
      .filter(Boolean);
  }

  function buildPredictionSummary(prediction) {
    if (!prediction) {
      return "Cada apostador pode registrar apenas uma aposta neste evento.";
    }

    return `Palpite registrado: ${prediction.predicted_value || "Sem palpite informado"} com ${formatPoints(prediction.amount)} CIC-points.`;
  }

  function getCombosForUser(userId) {
    return state.combos.filter((combo) => combo.user_id === userId);
  }

  function getComboLegs(comboId) {
    return state.comboLegs.filter((leg) => leg.combo_id === comboId);
  }

  function isAdmin(user) {
    return Boolean(user?.is_admin) || (state.config?.adminEmails || []).includes(String(user?.email || "").toLowerCase());
  }

  function getLeaderboardRows() {
    return state.users
      .map((user) => ({
        user,
        stats: getUserStats(user),
        character: getCharacter(user.character_id)
      }))
      .sort((a, b) => b.stats.balance - a.stats.balance);
  }

  function isBetOpen(bet) {
    return bet.status === "open" && new Date(bet.closes_at) > new Date();
  }

  function getBetStatusLabel(bet) {
    if (bet.status === "settled") {
      return { label: "Encerrada", className: "chip-closed" };
    }

    if (new Date(bet.closes_at) <= new Date()) {
      return { label: "Fechada", className: "chip-soon" };
    }

    return { label: "Aberta", className: "chip-open" };
  }

  function getUserStats(user) {
    const predictions = getPredictionsForUser(user.id);
    const combos = getCombosForUser(user.id);
    const predictionsStake = predictions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const comboStake = combos.reduce((sum, item) => sum + Number(item.stake || 0), 0);
    const winnings = predictions.reduce((sum, item) => sum + calculatePredictionSettledPayout(item), 0);
    const comboWinnings = combos.reduce((sum, item) => sum + calculateComboSettledPayout(item), 0);

    return {
      balance: Number(user.starting_balance || 0) - predictionsStake - comboStake + winnings + comboWinnings
    };
  }

  function didPredictionWin(prediction) {
    const bet = getBet(prediction.bet_id);
    return Boolean(bet && bet.status === "settled" && prediction.is_correct === true);
  }

  function calculatePredictionPayout(prediction) {
    const bet = getBet(prediction.bet_id);

    if (!bet) {
      return 0;
    }

    return Math.round(Number(prediction.amount || 0) * Number(bet.base_multiplier || 0));
  }

  function calculatePredictionSettledPayout(prediction) {
    return didPredictionWin(prediction) ? calculatePredictionPayout(prediction) : 0;
  }

  function getComboStatus(combo) {
    const legs = getComboLegs(combo.id);
    const hasLostLeg = legs.some((leg) => {
      const bet = getBet(leg.bet_id);
      return bet && bet.status === "settled" && bet.winning_option_id !== leg.bet_option_id;
    });

    if (hasLostLeg) {
      return "Perdido";
    }

    const allWon =
      legs.length > 0 &&
      legs.every((leg) => {
        const bet = getBet(leg.bet_id);
        return bet && bet.status === "settled" && bet.winning_option_id === leg.bet_option_id;
      });

    return allWon ? "Vencedor" : "Pendente";
  }

  function calculateComboSettledPayout(combo) {
    return getComboStatus(combo) === "Vencedor" ? Number(combo.potential_payout || 0) : 0;
  }

  function logout() {
    clearSession();
    state.session = null;
    renderSessionNav();
    renderAll();
    dom.loginForm.reset();
    dom.registerForm.reset();
    dom.registerBalance.value = 1000;
    resetAvatarSelection();
    setActiveView("home");
    setFeedback("Sessao encerrada.", "success", true);
  }

  function persistSession(session) {
    localStorage.setItem("cicbet.session", JSON.stringify(session));
  }

  function persistThemePreference(theme) {
    localStorage.setItem(themeStorageKey, theme);
  }

  function clearSession() {
    localStorage.removeItem("cicbet.session");
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem("cicbet.session");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function loadThemePreference() {
    try {
      const theme = localStorage.getItem(themeStorageKey);
      return theme === "light" ? "light" : "dark";
    } catch (error) {
      return "dark";
    }
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(payload.message || "Falha na requisicao.");
    }

    return payload;
  }

  function setFeedback(message, tone, autoHide) {
    dom.globalFeedback.textContent = message;
    dom.globalFeedback.className = `alert ${tone || "info"}`;
    dom.globalFeedback.classList.remove("hidden");

    if (autoHide) {
      window.clearTimeout(setFeedback.timeoutId);
      setFeedback.timeoutId = window.setTimeout(() => {
        dom.globalFeedback.classList.add("hidden");
      }, 3000);
    }
  }

  function clearFeedback() {
    window.clearTimeout(setFeedback.timeoutId);
    dom.globalFeedback.classList.add("hidden");
    dom.globalFeedback.textContent = "";
  }

  function showConfigError(message) {
    dom.configAlert.textContent = message;
    dom.configAlert.className = "alert error";
    dom.configAlert.classList.remove("hidden");
  }

  function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function applyTheme(theme, persist) {
    const resolvedTheme = theme === "light" ? "light" : "dark";
    state.theme = resolvedTheme;
    document.body.dataset.theme = resolvedTheme;
    renderThemeToggleButton();

    if (persist) {
      persistThemePreference(resolvedTheme);
    }
  }

  function renderThemeToggleButton() {
    if (!dom.themeToggleButton) {
      return;
    }

    const nextTheme = state.theme === "dark" ? "light" : "dark";
    const label = nextTheme === "dark" ? "Ativar modo escuro" : "Ativar modo claro";
    dom.themeToggleButton.setAttribute("aria-label", label);
    dom.themeToggleButton.setAttribute("title", label);
  }

  function renderAvatarUploadState() {
    const customSelected = isCustomAvatar(selectedAvatar);
    dom.avatarUploadButton.textContent = customSelected ? "Trocar minha foto" : "Usar minha foto";
    dom.avatarResetButton.classList.toggle("hidden", !customSelected);
    dom.avatarUploadHint.textContent = customSelected
      ? "Sua foto foi ajustada para o formato de avatar. Voce pode trocar ou voltar para um avatar da arena."
      : "PNG, JPG, WEBP ou GIF. A imagem sera recortada e ajustada automaticamente para o avatar.";
  }

  function resetAvatarSelection() {
    selectedAvatar = avatarOptions[0];
    dom.registerAvatarUpload.value = "";
    renderAvatarPicker();
  }

  function isCustomAvatar(value) {
    return String(value || "").startsWith("data:image/");
  }

  function validateAvatarFile(file) {
    if (!avatarUploadTypes.has(file.type)) {
      throw new Error("Use uma imagem PNG, JPG, WEBP ou GIF para o avatar.");
    }

    if (file.size > maxAvatarUploadSize) {
      throw new Error("A foto do avatar deve ter no maximo 5 MB.");
    }
  }

  async function buildAvatarDataUrl(file) {
    const source = await readFileAsDataUrl(file);
    const image = await loadImage(source);
    const cropSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const offsetX = Math.max(0, ((image.naturalWidth || image.width) - cropSize) / 2);
    const offsetY = Math.max(0, ((image.naturalHeight || image.height) - cropSize) / 2);
    const canvas = document.createElement("canvas");

    canvas.width = avatarOutputSize;
    canvas.height = avatarOutputSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Nao foi possivel preparar a imagem do avatar.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      offsetX,
      offsetY,
      cropSize,
      cropSize,
      0,
      0,
      avatarOutputSize,
      avatarOutputSize
    );

    const dataUrl = canvas.toDataURL("image/jpeg", avatarOutputQuality);
    if (dataUrl.length > maxAvatarDataUrlLength) {
      throw new Error("A foto ficou muito pesada. Tente uma imagem mais simples ou menor.");
    }

    return dataUrl;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem escolhida."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("A imagem escolhida nao pode ser usada como avatar."));
      image.src = src;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatCharacterCodename(slug) {
    return String(slug || "")
      .split("-")
      .map((part) => part.toUpperCase())
      .join(" / ");
  }

  function formatPoints(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  }
})();
