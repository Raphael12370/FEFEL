const CONFIGS = {
  global: {
    maxTokens: 3000,
    prompt: ({ date }) => `Voce e um analista geopolitico e economico senior. Data atual: ${date}.

Pesquise as principais noticias geopoliticas e economicas globais que podem afetar o mercado financeiro brasileiro hoje. Organize com os titulos EXATOS abaixo em maiusculas:

GEOPOLITICA
Principais tensoes e eventos geopoliticos globais: guerras, sancoes, eleicoes relevantes, acordos diplomaticos.

BANCOS CENTRAIS
Fed (EUA), BCE (Europa), Banco do Japao: decisoes de juros, comunicados, expectativas do mercado.

COMMODITIES
Petroleo (WTI e Brent), minerio de ferro, soja, milho, cobre. Precos atuais e drivers do dia.

CHINA
Economia chinesa, exportacoes, politica monetaria, relacoes comerciais com EUA e Brasil.

IMPACTOS NO BRASIL
Como os fatores globais acima estao afetando o Brasil hoje. Seja especifico com numeros e cotacoes.

Use dados reais, seja objetivo e cite fontes quando possivel.`
  },

  relatorios: {
    maxTokens: 6000,
    prompt: ({ stocks, date }) => {
      const list = stocks.map(s => `${s.ticker} (${s.name})`).join(', ');
      return `Voce e um analista fundamentalista senior. Data: ${date}.

Para cada empresa abaixo, pesquise os resultados financeiros dos ULTIMOS 4 TRIMESTRES publicados (earnings releases / ITR / DFP na CVM ou RI da empresa). Para cada trimestre informe: periodo (ex: 1T25), Receita Liquida, EBITDA, Lucro Liquido, e variacao percentual vs mesmo trimestre do ano anterior.

Empresas: ${list}

Use o TICKER de cada empresa como titulo da secao em maiusculas (exatamente como listado acima). Para cada empresa mostre os 4 trimestres em ordem cronologica. Se nao encontrar dados de algum trimestre escreva "Dado nao disponivel".`;
    }
  },

  empresas: {
    maxTokens: 4000,
    prompt: ({ stocks, date }) => {
      const list = stocks.map(s => `${s.ticker} (${s.name})`).join(', ');
      return `Voce e um analista de noticias financeiras. Data: ${date}.

Para cada empresa abaixo, pesquise noticias das ULTIMAS 24-48 HORAS que possam impactar o preco da acao. Exemplos: mudanca de CEO ou diretoria, novos contratos, investigacoes ou multas, rebaixamento ou elevacao de rating por analistas, fusoes e aquisicoes, resultados surpresa, greves, acidentes, decisoes regulatorias.

Empresas: ${list}

Use o TICKER de cada empresa como titulo da secao em maiusculas (exatamente como listado acima). Se nao houver noticias relevantes para uma empresa, escreva exatamente: "Sem noticias relevantes nas ultimas 24h."`;
    }
  },

  macro: {
    maxTokens: 3000,
    prompt: ({ date }) => `Voce e um economista especializado no mercado brasileiro. Data: ${date}.

Pesquise e resuma os principais eventos macroeconomicos do dia. Organize com os titulos EXATOS abaixo em maiusculas:

IBOVESPA
Pontuacao atual, variacao do dia, volume financeiro, principais altas e baixas.

SELIC E JUROS
Situacao atual da SELIC, proxima reuniao do COPOM, expectativas do mercado (Focus/B3).

INFLACAO
IPCA e IGPM: ultimos dados divulgados, tendencia atual, meta do Banco Central.

CAMBIO
BRL/USD atual, variacao do dia, principais fatores que estao movendo o cambio.

POLITICA FISCAL
Gastos publicos, arrecadacao, relacao divida/PIB, declaracoes do Ministerio da Fazenda.

DADOS DO DIA
Indicadores economicos divulgados hoje (PIB, desemprego, producao industrial, balanca comercial, etc). Se nenhum indicador relevante foi divulgado hoje, escreva isso explicitamente.

Use numeros reais e cite fontes quando possivel.`
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
