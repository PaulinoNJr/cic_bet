const defaultCharacters = [
  {
    id: "7c6376b7-6c80-4874-bc5f-0fca2c47e0a1",
    slug: "aurora-pulse",
    name: "Aurora Vanta",
    imageUrl: "/characters/aurora-pulse.svg",
    description: "Estrategista de leitura instantanea que transforma padroes sutis em viradas brutais.",
    accentColor: "#2dd4bf",
    sortOrder: 1
  },
  {
    id: "2d265f9e-f0f6-4a4d-85f2-51b8fbe02740",
    slug: "byte-baron",
    name: "Byte Regent",
    imageUrl: "/characters/byte-baron.svg",
    description: "Calculista de elite que joga no limite entre probabilidade fria e dominio absoluto.",
    accentColor: "#14b8a6",
    sortOrder: 2
  },
  {
    id: "0cfbc272-d73a-4dfa-885c-1e35cf1f2734",
    slug: "nova-lynx",
    name: "Nova Lynx Prime",
    imageUrl: "/characters/nova-lynx.svg",
    description: "Predadora de ritmo rapido, perfeita para apostas explosivas e reviravoltas improvaveis.",
    accentColor: "#fb923c",
    sortOrder: 3
  },
  {
    id: "ba589753-2049-4174-9f8f-eeb222e98db4",
    slug: "captain-loop",
    name: "Captain Loop Zero",
    imageUrl: "/characters/captain-loop.svg",
    description: "Comandante de consistencia cirurgica, construido para streaks longos e controle total.",
    accentColor: "#60a5fa",
    sortOrder: 4
  },
  {
    id: "8053b478-a6ca-412e-bdab-5fa7fca886e4",
    slug: "echo-matrix",
    name: "Echo Matrix X",
    imageUrl: "/characters/echo-matrix.svg",
    description: "Decodifica ruído, encontra sinais ocultos e domina partidas que parecem impossiveis de ler.",
    accentColor: "#a78bfa",
    sortOrder: 5
  },
  {
    id: "f7af2dcf-f9fc-4728-8d32-656d0ff76d95",
    slug: "solar-drift",
    name: "Solar Drift IX",
    imageUrl: "/characters/solar-drift.svg",
    description: "Especialista em alto risco e alto retorno, sempre buscando o golpe mais ousado da rodada.",
    accentColor: "#facc15",
    sortOrder: 6
  }
];

async function ensureDefaultCharacters(client) {
  for (const character of defaultCharacters) {
    await client.query(
      `
        insert into characters (id, slug, name, image_url, description, accent_color, sort_order)
        values (?, ?, ?, ?, ?, ?, ?)
        on conflict (slug) do update
        set
          id = coalesce(characters.id, excluded.id),
          name = excluded.name,
          image_url = excluded.image_url,
          description = excluded.description,
          accent_color = excluded.accent_color,
          sort_order = excluded.sort_order
      `,
      [
        character.id,
        character.slug,
        character.name,
        character.imageUrl,
        character.description,
        character.accentColor,
        character.sortOrder
      ]
    );
  }
}

module.exports = {
  ensureDefaultCharacters
};
