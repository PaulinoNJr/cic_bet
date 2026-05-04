(function () {
  const { createClient } = window.supabase;

  const avatarOptions = [
    "/public/avatars/avatar-01.svg",
    "/public/avatars/avatar-02.svg",
    "/public/avatars/avatar-03.svg",
    "/public/avatars/avatar-04.svg",
    "/public/avatars/avatar-05.svg",
    "/public/avatars/avatar-06.svg"
  ];

  const riskMultipliers = {
    low: 1.12,
    medium: 1.35,
    high: 1.7
  };

  const state = {
    supabase: null,
    config: null,
    session: loadSession(),
    users: [],
    characters: [],
    bets: [],
    betOptions: [],
    predictions: [],
    combos: [],
    comboLegs: [],
    authMode: "login"
  };

  const dom = {
    configAlert: document.getElementById("config-alert"),
    globalFeedback: document.getElementById("global-feedback"),
    summaryGrid: document.getElementById("summary-grid"),
    sessionCard: document.getElementById("session-card"),
    activityFeed: document.getElementById("activity-feed"),
    charactersGallery: document.getElementById("characters-gallery"),
    authForm: document.getElementById("auth-form"),
    authName: document.getElementById("auth-name"),
    authEmail: document.getElementById("auth-email"),
    authCharacter: document.getElementById("auth-character"),
    authBalance: document.getElementById("auth-balance"),
    authSubmit: document.getElementById("auth-submit"),
    characterField: document.getElementById("character-field"),
    balanceField: document.getElementById("balance-field"),
    avatarField: document.getElementById("avatar-field"),
    betForm: document.getElementById("bet-form"),
    betsList: document.getElementById("bets-list"),
    comboForm: document.getElementById("combo-form"),
    comboBuilder: document.getElementById("combo-builder"),
    comboPreview: document.getElementById("combo-preview"),
    comboHistory: document.getElementById("combo-history"),
    playersRanking: document.getElementById("players-ranking"),
    betsRanking: document.getElementById("bets-ranking"),
    adminPanel: document.getElementById("admin-panel"),
    refreshButton: document.getElementById("refresh-button"),
    logoutButton: document.getElementById("logout-button"),
    themeToggle: document.getElementById("theme-toggle")
  };

  let selectedAvatar = avatarOptions[0];

  bindEvents();
  init();

  async function init() {
    setFeedback("Conectando com a configuracao do projeto...", "subtle");

    try {
      state.config = await loadRuntimeConfig();
      validateConfig(state.config);
      state.supabase = createClient(state.config.supabaseUrl, state.config.supabaseAnonKey);
      await refreshData();
      setFeedback("Dados carregados com sucesso.", "success", true);
    } catch (error) {
      console.error(error);
      showConfigError(
        "Nao foi possivel inicializar a pagina. Configure SUPABASE_URL e SUPABASE_ANON_KEY no Vercel e use o SQL de supabase/schema.sql."
      );
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.authMode = button.dataset.authMode;
        document.querySelectorAll("[data-auth-mode]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        renderAuthMode();
      });
    });

    dom.authForm.addEventListener("submit", handleAuthSubmit);
    dom.betForm.addEventListener("submit", handleBetSubmit);
    dom.comboForm.addEventListener("submit", handleComboSubmit);
    dom.betsList.addEventListener("submit", handleBetEntrySubmit);
    dom.adminPanel.addEventListener("submit", handleResolveSubmit);
    dom.refreshButton.addEventListener("click", refreshData);
    dom.logoutButton.addEventListener("click", logout);
    dom.themeToggle.addEventListener("click", toggleTheme);
    dom.comboBuilder.addEventListener("change", renderComboPreview);
  }

  function toggleTheme() {
    const html = document.documentElement;
    const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", nextTheme);
    localStorage.setItem("cicbet.theme", nextTheme);
  }

  function applyTheme() {
    const savedTheme = localStorage.getItem("cicbet.theme");
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }

  async function loadRuntimeConfig() {
    applyTheme();
    const response = await fetch("/api/config");
    if (!response.ok) {
      throw new Error("Falha ao carregar configuracao.");
    }
    return response.json();
  }

  function validateConfig(config) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error("Configuracao do Supabase ausente.");
    }
  }

  async function refreshData() {
    if (!state.supabase) {
      return;
    }

    setFeedback("Atualizando dados do Supabase...", "subtle");

    const [
      charactersResult,
      usersResult,
      betsResult,
      optionsResult,
      predictionsResult,
      combosResult,
      comboLegsResult
    ] = await Promise.all([
      state.supabase.from("characters").select("*").order("sort_order", { ascending: true }),
      state.supabase.from("users").select("*").order("created_at", { ascending: true }),
      state.supabase.from("bets").select("*").order("created_at", { ascending: false }),
      state.supabase.from("bet_options").select("*").order("sort_order", { ascending: true }),
      state.supabase.from("predictions").select("*").order("created_at", { ascending: false }),
      state.supabase.from("combos").select("*").order("created_at", { ascending: false }),
      state.supabase.from("combo_legs").select("*").order("created_at", { ascending: true })
    ]);

    const results = [
      charactersResult,
      usersResult,
      betsResult,
      optionsResult,
      predictionsResult,
      combosResult,
      comboLegsResult
    ];

    const firstError = results.find((item) => item.error)?.error;
    if (firstError) {
      throw firstError;
    }

    state.characters = charactersResult.data || [];
    state.users = usersResult.data || [];
    state.bets = betsResult.data || [];
    state.betOptions = optionsResult.data || [];
    state.predictions = predictionsResult.data || [];
    state.combos = combosResult.data || [];
    state.comboLegs = comboLegsResult.data || [];

    syncSessionUser();
    renderAll();
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

  function renderAll() {
    renderAuthMode();
    renderAvatarPicker();
    renderCharacters();
    renderSessionCard();
    renderSummary();
    renderFeed();
    renderBets();
    renderComboBuilder();
    renderComboHistory();
    renderRanking();
    renderAdmin();
    renderComboPreview();
  }

  function renderAuthMode() {
    const isRegister = state.authMode === "register";
    dom.characterField.classList.toggle("hidden", !isRegister);
    dom.balanceField.classList.toggle("hidden", !isRegister);
    dom.avatarField.classList.toggle("hidden", !isRegister);
    dom.authSubmit.textContent = isRegister ? "Criar perfil" : "Entrar na arena";

    dom.authCharacter.innerHTML = state.characters
      .map((character) => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)}</option>`)
      .join("");
  }

  function renderAvatarPicker() {
    dom.avatarField.innerHTML = avatarOptions
      .map((avatar) => {
        const active = avatar === selectedAvatar ? "active" : "";
        return `
          <button class="pick-avatar ${active}" type="button" data-avatar="${escapeHtml(avatar)}">
            <img src="${escapeHtml(avatar)}" alt="Avatar" />
          </button>
        `;
      })
      .join("");

    dom.avatarField.querySelectorAll("[data-avatar]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedAvatar = button.dataset.avatar;
        renderAvatarPicker();
      });
    });
  }

  function renderCharacters() {
    if (!state.characters.length) {
      dom.charactersGallery.innerHTML = emptyCard("Rode o SQL do Supabase para carregar os personagens iniciais.");
      return;
    }

    dom.charactersGallery.innerHTML = state.characters
      .map(
        (character) => `
          <article class="character-card">
            <img src="${escapeHtml(character.image_url)}" alt="${escapeHtml(character.name)}" />
            <span class="tag">${escapeHtml(character.slug)}</span>
            <h3>${escapeHtml(character.name)}</h3>
            <p>${escapeHtml(character.description || "Sem descricao.")}</p>
          </article>
        `
      )
      .join("");
  }

  function renderSessionCard() {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      dom.logoutButton.classList.add("hidden");
      dom.sessionCard.innerHTML = emptyCard("Nenhum usuario logado. Entre ou crie um perfil para participar.");
      return;
    }

    dom.logoutButton.classList.remove("hidden");
    const character = getCharacter(currentUser.character_id);
    const stats = getUserStats(currentUser);

    dom.sessionCard.innerHTML = `
      <div class="session-user">
        <img class="avatar" src="${escapeHtml(currentUser.avatar_url || character?.image_url || avatarOptions[0])}" alt="${escapeHtml(currentUser.name)}" />
        <div>
          <strong>${escapeHtml(currentUser.name)}</strong>
          <div>${escapeHtml(currentUser.email)}</div>
          <small>${escapeHtml(character?.name || "Sem personagem")}</small>
        </div>
        <span class="balance-pill">${formatPoints(stats.balance)} CICPoints</span>
      </div>
    `;
  }

  function renderSummary() {
    const currentUser = getCurrentUser();
    const openBets = state.bets.filter((bet) => isBetOpen(bet));
    const totalVolume = state.predictions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalCombos = state.combos.length;

    const summaryItems = currentUser
      ? (() => {
          const stats = getUserStats(currentUser);
          return [
            {
              label: "Saldo atual",
              value: `${formatPoints(stats.balance)} pts`,
              hint: "Calculado a partir das entradas e dos resultados."
            },
            {
              label: "Taxa de acerto",
              value: `${formatPercent(stats.accuracy)}%`,
              hint: `${stats.wins} acertos em ${stats.settledPredictions} apostas resolvidas`
            },
            {
              label: "Apostas abertas",
              value: String(openBets.length),
              hint: "Mercados ainda aceitando participacao"
            },
            {
              label: "Combos no sistema",
              value: String(totalCombos),
              hint: "Historico consolidado de combinadas"
            }
          ];
        })()
      : [
          {
            label: "Jogadores cadastrados",
            value: String(state.users.length),
            hint: "Total de apostadores ativos no banco"
          },
          {
            label: "Apostas abertas",
            value: String(openBets.length),
            hint: "Mercados ainda aceitando participacao"
          },
          {
            label: "Volume apostado",
            value: `${formatPoints(totalVolume)} pts`,
            hint: "Soma das entradas registradas"
          },
          {
            label: "Combos criados",
            value: String(totalCombos),
            hint: "Historico de combinadas"
          }
        ];

    dom.summaryGrid.innerHTML = summaryItems
      .map(
        (item) => `
          <article class="summary-card">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <small>${escapeHtml(item.hint)}</small>
          </article>
        `
      )
      .join("");
  }

  function renderFeed() {
    const currentUser = getCurrentUser();
    const feed = [];

    if (currentUser) {
      getPredictionsForUser(currentUser.id)
        .slice(0, 4)
        .forEach((prediction) => {
          const bet = getBet(prediction.bet_id);
          const option = getOption(prediction.bet_option_id);
          const payout = calculatePredictionPayout(prediction);
          feed.push({
            title: bet?.title || "Aposta",
            description: `${option?.label || "Opcao"} • ${formatPoints(prediction.amount)} pts`,
            meta: predictionStatusLabel(prediction),
            extra: payout > 0 ? `Retorno potencial: ${formatPoints(payout)} pts` : "Aguardando resultado"
          });
        });

      getCombosForUser(currentUser.id)
        .slice(0, 3)
        .forEach((combo) => {
          const comboStatus = getComboStatus(combo);
          feed.push({
            title: `Combo com ${getComboLegs(combo.id).length} selecoes`,
            description: `${formatPoints(combo.stake)} pts • ${comboStatus.label}`,
            meta: `Odds ${combo.final_odds.toFixed(2)}x`,
            extra: `Potencial ${formatPoints(combo.potential_payout)} pts`
          });
        });
    }

    if (!feed.length) {
      dom.activityFeed.innerHTML = emptyCard("As ultimas entradas e combinadas vao aparecer aqui.");
      return;
    }

    dom.activityFeed.innerHTML = feed
      .slice(0, 6)
      .map(
        (item) => `
          <article class="feed-item">
            <strong>${escapeHtml(item.title)}</strong>
            <div>${escapeHtml(item.description)}</div>
            <small>${escapeHtml(item.meta)}</small>
            <p>${escapeHtml(item.extra)}</p>
          </article>
        `
      )
      .join("");
  }

  function renderBets() {
    if (!state.bets.length) {
      dom.betsList.innerHTML = emptyCard("Nenhuma aposta cadastrada ainda.");
      return;
    }

    const currentUser = getCurrentUser();

    dom.betsList.innerHTML = state.bets
      .map((bet) => {
        const options = getOptionsForBet(bet.id);
        const volume = getPredictionsForBet(bet.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const status = getBetStatusLabel(bet);
        const disabledReason = !currentUser
          ? "Entre para participar."
          : !isBetOpen(bet)
            ? "Mercado encerrado."
            : "";

        return `
          <article class="bet-card">
            <div class="bet-card-header">
              <div>
                <span class="tag ${status.tone}">${escapeHtml(status.label)}</span>
                <h3>${escapeHtml(bet.title)}</h3>
                <p>${escapeHtml(bet.description || "Sem descricao.")}</p>
              </div>
              <div class="balance-pill">${Number(bet.base_multiplier).toFixed(2)}x</div>
            </div>
            <div class="bet-meta">
              <span class="tag">Fecha em ${escapeHtml(formatDateTime(bet.closes_at))}</span>
              <span class="tag">${escapeHtml(capitalize(bet.risk_level))}</span>
              <span class="tag">${formatPoints(volume)} pts no mercado</span>
            </div>
            <div class="bet-options">
              ${options
                .map(
                  (option) => `
                    <div class="bet-option">
                      <strong>${escapeHtml(option.label)}</strong>
                      <div>Odd ${Number(option.odds_multiplier).toFixed(2)}x</div>
                    </div>
                  `
                )
                .join("")}
            </div>
            <form class="bet-inline-form" data-bet-form data-bet-id="${escapeHtml(bet.id)}">
              <select name="bet_option_id" ${disabledReason ? "disabled" : ""}>
                ${options
                  .map(
                    (option) => `
                      <option value="${escapeHtml(option.id)}">
                        ${escapeHtml(option.label)} • ${Number(option.odds_multiplier).toFixed(2)}x
                      </option>
                    `
                  )
                  .join("")}
              </select>
              <input name="amount" type="number" min="10" value="50" ${disabledReason ? "disabled" : ""} />
              <button class="inline-button" type="submit" ${disabledReason ? "disabled" : ""}>Apostar</button>
            </form>
            ${disabledReason ? `<small>${escapeHtml(disabledReason)}</small>` : ""}
          </article>
        `;
      })
      .join("");
  }

  function renderComboBuilder() {
    const openBets = state.bets.filter((bet) => isBetOpen(bet));

    if (!openBets.length) {
      dom.comboBuilder.innerHTML = emptyCard("Sem apostas abertas para montar combo.");
      return;
    }

    dom.comboBuilder.innerHTML = openBets
      .map((bet) => {
        const options = getOptionsForBet(bet.id);
        return `
          <article class="combo-option" data-combo-bet="${escapeHtml(bet.id)}">
            <label>
              <input type="checkbox" data-combo-check="${escapeHtml(bet.id)}" />
              <span>
                <strong>${escapeHtml(bet.title)}</strong><br />
                <small>Fecha em ${escapeHtml(formatDateTime(bet.closes_at))}</small>
              </span>
            </label>
            <select data-combo-option="${escapeHtml(bet.id)}">
              ${options
                .map(
                  (option) => `
                    <option value="${escapeHtml(option.id)}">
                      ${escapeHtml(option.label)} • ${Number(option.odds_multiplier).toFixed(2)}x
                    </option>
                  `
                )
                .join("")}
            </select>
          </article>
        `;
      })
      .join("");
  }

  function renderComboPreview() {
    const payload = readComboSelection();
    if (!payload.legs.length) {
      dom.comboPreview.innerHTML = "Escolha pelo menos duas apostas para visualizar as odds combinadas.";
      return;
    }

    const bonus = comboBonusMultiplier(payload.legs.length);
    const combinedOdds = calculateComboFinalOdds(payload.legs);
    const payout = Math.round(payload.stake * combinedOdds);

    dom.comboPreview.innerHTML = `
      <strong>${payload.legs.length} selecoes escolhidas</strong><br />
      Bonus progressivo: ${bonus.toFixed(2)}x<br />
      Odds simuladas: ${combinedOdds.toFixed(2)}x<br />
      Ganho potencial: ${formatPoints(payout)} CICPoints
    `;
  }

  function renderComboHistory() {
    const currentUser = getCurrentUser();
    const combos = currentUser ? getCombosForUser(currentUser.id) : state.combos;

    if (!combos.length) {
      dom.comboHistory.innerHTML = emptyCard("Nenhum combo registrado ainda.");
      return;
    }

    dom.comboHistory.innerHTML = combos
      .slice(0, 8)
      .map((combo) => {
        const comboStatus = getComboStatus(combo);
        const legs = getComboLegs(combo.id);
        return `
          <article class="combo-item">
            <div class="panel-head">
              <strong>Combo com ${legs.length} selecoes</strong>
              <span class="tag ${comboStatus.tone}">${escapeHtml(comboStatus.label)}</span>
            </div>
            <div>Stake: ${formatPoints(combo.stake)} pts</div>
            <div>Odds finais: ${Number(combo.final_odds).toFixed(2)}x</div>
            <div>Retorno potencial: ${formatPoints(combo.potential_payout)} pts</div>
          </article>
        `;
      })
      .join("");
  }

  function renderRanking() {
    renderPlayersRanking();
    renderBetsRanking();
  }

  function renderPlayersRanking() {
    const rows = state.users
      .map((user) => {
        const stats = getUserStats(user);
        const character = getCharacter(user.character_id);
        return {
          user,
          stats,
          character
        };
      })
      .sort((a, b) => b.stats.balance - a.stats.balance);

    if (!rows.length) {
      dom.playersRanking.innerHTML = emptyCard("Sem jogadores cadastrados.");
      return;
    }

    dom.playersRanking.innerHTML = `
      <div class="table-head">
        <span>#</span>
        <span>Apostador</span>
        <span>Personagem</span>
        <span>Saldo</span>
        <span>Acerto</span>
      </div>
      ${rows
        .map(
          (row, index) => `
            <div class="table-row">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(row.user.name)}</strong>
                <small>${escapeHtml(row.user.email)}</small>
              </div>
              <span>${escapeHtml(row.character?.name || "-")}</span>
              <span>${formatPoints(row.stats.balance)}</span>
              <span>${formatPercent(row.stats.accuracy)}%</span>
            </div>
          `
        )
        .join("")}
    `;
  }

  function renderBetsRanking() {
    if (!state.bets.length) {
      dom.betsRanking.innerHTML = emptyCard("Sem apostas para rankear.");
      return;
    }

    const rows = state.bets
      .map((bet) => {
        const entries = getPredictionsForBet(bet.id);
        const volume = entries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const winners = entries.filter((item) => didPredictionWin(item)).length;
        const settled = entries.filter((item) => isPredictionSettled(item)).length;
        return {
          bet,
          entries,
          volume,
          accuracy: settled ? (winners / settled) * 100 : 0
        };
      })
      .sort((a, b) => b.volume - a.volume);

    dom.betsRanking.innerHTML = `
      <div class="table-head">
        <span>#</span>
        <span>Aposta</span>
        <span>Status</span>
        <span>Volume</span>
        <span>Acerto</span>
      </div>
      ${rows
        .map((row, index) => {
          const status = getBetStatusLabel(row.bet);
          return `
            <div class="table-row">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(row.bet.title)}</strong>
                <small>${row.entries.length} entradas</small>
              </div>
              <span class="tag ${status.tone}">${escapeHtml(status.label)}</span>
              <span>${formatPoints(row.volume)}</span>
              <span>${formatPercent(row.accuracy)}%</span>
            </div>
          `;
        })
        .join("")}
    `;
  }

  function renderAdmin() {
    const currentUser = getCurrentUser();
    if (!currentUser || !isAdmin(currentUser)) {
      dom.adminPanel.innerHTML = emptyCard("Esta area aparece apenas para administradores configurados.");
      return;
    }

    const openBets = state.bets.filter((bet) => bet.status === "open");
    if (!openBets.length) {
      dom.adminPanel.innerHTML = emptyCard("Nao ha apostas abertas aguardando definicao.");
      return;
    }

    dom.adminPanel.innerHTML = openBets
      .map((bet) => {
        const options = getOptionsForBet(bet.id);
        return `
          <article class="admin-card">
            <div class="admin-card-header">
              <div>
                <span class="tag warning">Aguardando resultado</span>
                <h3>${escapeHtml(bet.title)}</h3>
                <p>${escapeHtml(bet.description || "Sem descricao.")}</p>
              </div>
              <span class="balance-pill">${formatDateTime(bet.closes_at)}</span>
            </div>
            <form data-resolve-form data-bet-id="${escapeHtml(bet.id)}">
              <select name="winning_option_id">
                ${options
                  .map(
                    (option) => `
                      <option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>
                    `
                  )
                  .join("")}
              </select>
              <button class="primary-button" type="submit">Definir vencedor</button>
            </form>
          </article>
        `;
      })
      .join("");
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!state.supabase) {
      return;
    }

    const email = dom.authEmail.value.trim().toLowerCase();
    const name = dom.authName.value.trim();

    if (!email) {
      setFeedback("Informe um email valido.", "error");
      return;
    }

    if (state.authMode === "login") {
      const existingUser = state.users.find((user) => user.email.toLowerCase() === email);
      if (!existingUser) {
        setFeedback("Usuario nao encontrado. Troque para cadastro e crie o perfil.", "error");
        return;
      }

      state.session = {
        userId: existingUser.id,
        email: existingUser.email
      };
      persistSession(state.session);
      renderAll();
      setFeedback(`Sessao iniciada para ${existingUser.name}.`, "success", true);
      return;
    }

    if (!name) {
      setFeedback("Informe o nome para criar o perfil.", "error");
      return;
    }

    const characterId = dom.authCharacter.value;
    const startingBalance = Number(dom.authBalance.value || 1000);

    if (state.users.some((user) => user.email.toLowerCase() === email)) {
      setFeedback("Ja existe um perfil com este email.", "error");
      return;
    }

    const { data, error } = await state.supabase
      .from("users")
      .insert({
        name,
        email,
        avatar_url: selectedAvatar,
        character_id: characterId,
        starting_balance: startingBalance,
        is_admin: isEmailAdmin(email)
      })
      .select("*")
      .single();

    if (error) {
      setFeedback(error.message, "error");
      return;
    }

    state.session = { userId: data.id, email: data.email };
    persistSession(state.session);
    dom.authForm.reset();
    dom.authBalance.value = 1000;
    await refreshData();
    setFeedback("Perfil criado com sucesso.", "success", true);
  }

  async function handleBetSubmit(event) {
    event.preventDefault();
    const currentUser = getCurrentUser();

    if (!currentUser) {
      setFeedback("Entre para criar uma aposta.", "error");
      return;
    }

    const title = document.getElementById("bet-title").value.trim();
    const description = document.getElementById("bet-description").value.trim();
    const closesAtInput = document.getElementById("bet-closes-at").value;
    const baseMultiplier = Number(document.getElementById("bet-multiplier").value || 1.6);
    const riskLevel = document.getElementById("bet-risk-level").value;
    const optionsText = document.getElementById("bet-options").value.trim();

    const closesAt = closesAtInput ? new Date(closesAtInput) : null;
    const parsedOptions = optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [label, odds] = line.split("|");
        return {
          label: label?.trim(),
          odds_multiplier: Number(odds || 1.5),
          sort_order: index + 1
        };
      })
      .filter((option) => option.label);

    if (!title || !closesAt || Number.isNaN(closesAt.getTime())) {
      setFeedback("Preencha titulo e encerramento validos.", "error");
      return;
    }

    if (closesAt <= new Date()) {
      setFeedback("A data de encerramento precisa ser futura.", "error");
      return;
    }

    if (parsedOptions.length < 2) {
      setFeedback("Informe pelo menos duas opcoes para a aposta.", "error");
      return;
    }

    const { data: bet, error: betError } = await state.supabase
      .from("bets")
      .insert({
        title,
        description,
        closes_at: closesAt.toISOString(),
        created_by: currentUser.id,
        base_multiplier: baseMultiplier,
        risk_level: riskLevel,
        status: "open"
      })
      .select("*")
      .single();

    if (betError) {
      setFeedback(betError.message, "error");
      return;
    }

    const { error: optionsError } = await state.supabase.from("bet_options").insert(
      parsedOptions.map((option) => ({
        ...option,
        bet_id: bet.id
      }))
    );

    if (optionsError) {
      setFeedback(optionsError.message, "error");
      return;
    }

    dom.betForm.reset();
    document.getElementById("bet-multiplier").value = 1.6;
    document.getElementById("bet-risk-level").value = "medium";
    document.getElementById("bet-options").value = "Time Orion|1.55\nTime Vega|1.75\nEmpate tecnico|2.20";
    await refreshData();
    setFeedback("Aposta criada com sucesso.", "success", true);
  }

  async function handleBetEntrySubmit(event) {
    const form = event.target.closest("[data-bet-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setFeedback("Entre para participar das apostas.", "error");
      return;
    }

    const betId = form.dataset.betId;
    const bet = getBet(betId);
    const optionId = form.querySelector('[name="bet_option_id"]').value;
    const amount = Number(form.querySelector('[name="amount"]').value || 0);

    if (!bet || !isBetOpen(bet)) {
      setFeedback("Esta aposta ja esta encerrada.", "error");
      return;
    }

    if (amount < 10) {
      setFeedback("A entrada minima e de 10 CICPoints.", "error");
      return;
    }

    const stats = getUserStats(currentUser);
    if (stats.balance < amount) {
      setFeedback("Saldo insuficiente para concluir a aposta.", "error");
      return;
    }

    const { error } = await state.supabase.from("predictions").insert({
      user_id: currentUser.id,
      bet_id: betId,
      bet_option_id: optionId,
      amount
    });

    if (error) {
      setFeedback(error.message, "error");
      return;
    }

    await refreshData();
    setFeedback("Aposta registrada com sucesso.", "success", true);
  }

  async function handleComboSubmit(event) {
    event.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setFeedback("Entre para montar um combo.", "error");
      return;
    }

    const payload = readComboSelection();
    if (payload.legs.length < 2) {
      setFeedback("Escolha pelo menos duas apostas diferentes para criar o combo.", "error");
      return;
    }

    const stats = getUserStats(currentUser);
    if (stats.balance < payload.stake) {
      setFeedback("Saldo insuficiente para registrar o combo.", "error");
      return;
    }

    const comboInsert = {
      user_id: currentUser.id,
      stake: payload.stake,
      bonus_multiplier: comboBonusMultiplier(payload.legs.length),
      final_odds: calculateComboFinalOdds(payload.legs),
      potential_payout: Math.round(payload.stake * calculateComboFinalOdds(payload.legs))
    };

    const { data: combo, error: comboError } = await state.supabase
      .from("combos")
      .insert(comboInsert)
      .select("*")
      .single();

    if (comboError) {
      setFeedback(comboError.message, "error");
      return;
    }

    const { error: legsError } = await state.supabase.from("combo_legs").insert(
      payload.legs.map((leg) => ({
        combo_id: combo.id,
        bet_id: leg.bet.id,
        bet_option_id: leg.option.id,
        created_at: new Date().toISOString()
      }))
    );

    if (legsError) {
      setFeedback(legsError.message, "error");
      return;
    }

    event.target.reset();
    document.getElementById("combo-stake").value = 80;
    renderComboPreview();
    await refreshData();
    setFeedback("Combo registrado com sucesso.", "success", true);
  }

  async function handleResolveSubmit(event) {
    const form = event.target.closest("[data-resolve-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser || !isAdmin(currentUser)) {
      setFeedback("Apenas admins podem definir resultados.", "error");
      return;
    }

    const betId = form.dataset.betId;
    const winningOptionId = form.querySelector('[name="winning_option_id"]').value;

    const { error } = await state.supabase
      .from("bets")
      .update({
        winning_option_id: winningOptionId,
        status: "settled"
      })
      .eq("id", betId);

    if (error) {
      setFeedback(error.message, "error");
      return;
    }

    await refreshData();
    setFeedback("Resultado definido com sucesso.", "success", true);
  }

  function readComboSelection() {
    const stake = Number(document.getElementById("combo-stake").value || 0);
    const checks = dom.comboBuilder.querySelectorAll("[data-combo-check]");
    const legs = [];

    checks.forEach((checkbox) => {
      if (!checkbox.checked) {
        return;
      }

      const betId = checkbox.dataset.comboCheck;
      const bet = getBet(betId);
      const optionId = dom.comboBuilder.querySelector(`[data-combo-option="${CSS.escape(betId)}"]`).value;
      const option = getOption(optionId);
      if (bet && option) {
        legs.push({ bet, option });
      }
    });

    return { stake, legs };
  }

  function getCurrentUser() {
    if (!state.session?.userId) {
      return null;
    }

    return state.users.find((user) => user.id === state.session.userId) || null;
  }

  function getCharacter(characterId) {
    return state.characters.find((character) => character.id === characterId) || null;
  }

  function getBet(betId) {
    return state.bets.find((bet) => bet.id === betId) || null;
  }

  function getOption(optionId) {
    return state.betOptions.find((option) => option.id === optionId) || null;
  }

  function getOptionsForBet(betId) {
    return state.betOptions.filter((option) => option.bet_id === betId);
  }

  function getPredictionsForBet(betId) {
    return state.predictions.filter((prediction) => prediction.bet_id === betId);
  }

  function getPredictionsForUser(userId) {
    return state.predictions.filter((prediction) => prediction.user_id === userId);
  }

  function getCombosForUser(userId) {
    return state.combos.filter((combo) => combo.user_id === userId);
  }

  function getComboLegs(comboId) {
    return state.comboLegs.filter((leg) => leg.combo_id === comboId);
  }

  function isEmailAdmin(email) {
    return (state.config.adminEmails || []).includes(email.toLowerCase());
  }

  function isAdmin(user) {
    return Boolean(user.is_admin) || isEmailAdmin(user.email);
  }

  function isBetOpen(bet) {
    return bet.status === "open" && new Date(bet.closes_at) > new Date();
  }

  function getBetStatusLabel(bet) {
    if (bet.status === "settled") {
      return { label: "Encerrada", tone: "success" };
    }

    if (new Date(bet.closes_at) <= new Date()) {
      return { label: "Fechada", tone: "warning" };
    }

    return { label: "Aberta", tone: "success" };
  }

  function getUserStats(user) {
    const predictions = getPredictionsForUser(user.id);
    const combos = getCombosForUser(user.id);
    const predictionsStake = predictions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const comboStake = combos.reduce((sum, item) => sum + Number(item.stake || 0), 0);
    const winnings = predictions.reduce((sum, item) => sum + calculatePredictionSettledPayout(item), 0);
    const comboWinnings = combos.reduce((sum, item) => sum + calculateComboSettledPayout(item), 0);
    const settledPredictions = predictions.filter((item) => isPredictionSettled(item)).length;
    const wins = predictions.filter((item) => didPredictionWin(item)).length;
    const balance = Number(user.starting_balance || 0) - predictionsStake - comboStake + winnings + comboWinnings;

    return {
      balance,
      wins,
      settledPredictions,
      accuracy: settledPredictions ? (wins / settledPredictions) * 100 : 0,
      winnings,
      comboWinnings
    };
  }

  function predictionStatusLabel(prediction) {
    if (!isPredictionSettled(prediction)) {
      return "Aguardando resultado";
    }
    return didPredictionWin(prediction) ? "Aposta vencedora" : "Aposta perdida";
  }

  function isPredictionSettled(prediction) {
    const bet = getBet(prediction.bet_id);
    return Boolean(bet && bet.status === "settled" && bet.winning_option_id);
  }

  function didPredictionWin(prediction) {
    const bet = getBet(prediction.bet_id);
    return Boolean(bet && bet.status === "settled" && bet.winning_option_id === prediction.bet_option_id);
  }

  function calculatePredictionPayout(prediction) {
    const bet = getBet(prediction.bet_id);
    const option = getOption(prediction.bet_option_id);
    if (!bet || !option) {
      return 0;
    }

    const riskMultiplier = riskMultipliers[bet.risk_level] || 1.35;
    return Math.round(Number(prediction.amount) * Number(bet.base_multiplier) * riskMultiplier * Number(option.odds_multiplier));
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
      return { label: "Perdido", tone: "danger" };
    }

    const allSettled = legs.every((leg) => {
      const bet = getBet(leg.bet_id);
      return bet && bet.status === "settled" && bet.winning_option_id === leg.bet_option_id;
    });

    if (allSettled && legs.length) {
      return { label: "Vencedor", tone: "success" };
    }

    return { label: "Pendente", tone: "warning" };
  }

  function calculateComboSettledPayout(combo) {
    return getComboStatus(combo).label === "Vencedor" ? Number(combo.potential_payout || 0) : 0;
  }

  function comboBonusMultiplier(legsCount) {
    if (legsCount <= 1) {
      return 1;
    }
    return Number((1 + (legsCount - 1) * 0.12).toFixed(2));
  }

  function calculateComboFinalOdds(legs) {
    const base = legs.reduce((product, leg) => {
      return product * Number(leg.option.odds_multiplier) * Number(leg.bet.base_multiplier) * 0.45;
    }, 1);

    return Number((base * comboBonusMultiplier(legs.length)).toFixed(2));
  }

  function logout() {
    clearSession();
    state.session = null;
    renderAll();
    setFeedback("Sessao encerrada.", "success", true);
  }

  function persistSession(session) {
    localStorage.setItem("cicbet.session", JSON.stringify(session));
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

  function setFeedback(message, tone, autoHide) {
    dom.globalFeedback.textContent = message;
    dom.globalFeedback.className = `alert ${tone || "subtle"}`;
    dom.globalFeedback.classList.remove("hidden");

    if (autoHide) {
      window.clearTimeout(setFeedback.timeoutId);
      setFeedback.timeoutId = window.setTimeout(() => {
        dom.globalFeedback.classList.add("hidden");
      }, 3500);
    }
  }

  function showConfigError(message) {
    dom.configAlert.textContent = message;
    dom.configAlert.className = "alert error";
    dom.configAlert.classList.remove("hidden");
  }

  function emptyCard(message) {
    return `<div class="empty-card">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function capitalize(value) {
    if (!value) {
      return "";
    }
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function formatPoints(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  }

  function formatPercent(value) {
    return Number(value || 0).toFixed(1);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }
})();
