const FORMATO = `

REGRAS DE FORMATACAO (obrigatorio):
- Escreva em paragrafos corridos, sem bullet points, sem hifens como lista, sem asteriscos.
- Nao use markdown. Nao use negrito. Nao use "•", "-" ou numeracao como lista.
- Cada secao comeca com o titulo em maiusculas numa linha propria, seguido de um ou dois paragrafos de texto corrido.
- Seja objetivo e use numeros reais. Cite a fonte entre parenteses ao final da frase quando relevante.`;

const CONFIGS = {
  global: {
    maxTokens: 3000,
    prompt: ({ date }) => `Voce e um analista geopolitico e economico senior. Data atual: ${date}.

Pesquise as principais noticias geopoliticas e economicas globais que podem afetar o mercado financeiro brasileiro hoje. Use os titulos EXATOS abaixo, cada um em sua propria linha em maiusculas, seguido de um paragrafo de texto corrido:

GEOPOLITICA
Principais tensoes e eventos geopoliticos globais: guerras, sancoes, eleicoes relevantes, acordos diplomaticos. Escreva em paragrafo corrido.

BANCOS CENTRAIS
Fed (EUA), BCE (Europa), Banco do Japao: decisoes de juros, comunicados recentes, expectativas do mercado. Escreva em paragrafo corrido.

COMMODITIES
Petroleo (WTI e Brent com valores em dolares), minerio de ferro, soja, milho, cobre. Precos atuais e principais drivers. Escreva em paragrafo corrido.

CHINA
Economia chinesa, exportacoes, politica monetaria, relacoes comerciais com EUA e Brasil. Escreva em paragrafo corrido.

IMPACTOS NO BRASIL
Como os fatores globais acima estao afetando o Brasil hoje, com valores de cambio e outros indicadores. Escreva em paragrafo corrido.
${FORMATO}`
  },

  relatorios: {
    maxTokens: 6000,
    prompt: ({ stocks, date }) => {
      const list = stocks.map(s => `${s.ticker} (${s.name})`).join(', ');
      return `Voce e um analista fundamentalista senior. Data: ${date}.

Para cada empresa abaixo, pesquise os resultados financeiros dos ULTIMOS 4 TRIMESTRES publicados (earnings releases, ITR ou DFP na CVM). Para cada trimestre informe o periodo (ex: 3T25), Receita Liquida, EBITDA, Lucro Liquido e variacao percentual vs mesmo trimestre do ano anterior.

Empresas: ${list}

Use o TICKER de cada empresa como titulo da secao em maiusculas numa linha propria. Abaixo do titulo, descreva os 4 trimestres em texto corrido, trimestre por trimestre em ordem cronologica. Nao use tabelas. Se nao encontrar dados de algum trimestre, escreva isso no texto.
${FORMATO}`;
    }
  },

  empresas: {
    maxTokens: 4000,
    prompt: ({ stocks, date }) => {
      const list = stocks.map(s => `${s.ticker} (${s.name})`).join(', ');
      return `Voce e um analista de noticias financeiras. Data: ${date}.

Para cada empresa abaixo, pesquise noticias das ULTIMAS 24-48 HORAS que possam impactar o preco da acao: mudanca de CEO ou diretoria, novos contratos relevantes, investigacoes ou multas, rebaixamento ou elevacao de rating por analistas, fusoes, aquisicoes, resultados surpresa, greves, acidentes, decisoes regulatorias.

Empresas: ${list}

Use o TICKER de cada empresa como titulo da secao em maiusculas numa linha propria. Abaixo do titulo, escreva um paragrafo corrido com as noticias encontradas. Se nao houver noticias relevantes para uma empresa, escreva apenas: "Sem noticias relevantes nas ultimas 24h."
${FORMATO}`;
    }
  },

  macro: {
    maxTokens: 3000,
    prompt: ({ date }) => `Voce e um economista especializado no mercado brasileiro. Data: ${date}.

Pesquise e resuma os principais eventos macroeconomicos do dia. Use os titulos EXATOS abaixo, cada um em sua propria linha em maiusculas, seguido de um paragrafo de texto corrido:

IBOVESPA
Pontuacao atual, variacao percentual do dia, volume financeiro, principais altas e baixas do dia. Escreva em paragrafo corrido.

SELIC E JUROS
Nivel atual da SELIC, data da proxima reuniao do COPOM, expectativas do mercado segundo o Focus ou curva de juros. Escreva em paragrafo corrido.

INFLACAO
IPCA e IGPM: ultimos dados divulgados com valores percentuais, tendencia atual, comparacao com a meta do Banco Central. Escreva em paragrafo corrido.

CAMBIO
BRL/USD com valor atual e variacao percentual, principais fatores que estao movendo o cambio hoje. Escreva em paragrafo corrido.

POLITICA FISCAL
Gastos publicos, arrecadacao, relacao divida/PIB, declaracoes recentes do Ministerio da Fazenda. Escreva em paragrafo corrido.

DADOS DO DIA
Indicadores economicos divulgados hoje: PIB, desemprego, producao industrial, balanca comercial, etc. Se nenhum indicador relevante foi divulgado hoje, escreva isso explicitamente em uma frase.
${FORMATO}`
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { stocks, date, type } = req.body;

  if (!type || !CONFIGS[type]) {
    return res.status(400).json({ error: 'type must be one of: global, relatorios, empresas, macro' });
  }

  if ((type === 'relatorios' || type === 'empresas') && (!stocks || stocks.length === 0)) {
    return res.status(400).json({ error: 'stocks array is required for this type' });
  }

  const config = CONFIGS[type];
  const prompt = config.prompt({ stocks: stocks || [], date });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: config.maxTokens,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
