export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { stocks, date } = req.body;

  if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: 'stocks array is required' });
  }

  const stocksPrompt = stocks
    .map(s => `${s.ticker} - ${(s.name || s.ticker).toUpperCase()}\nNoticias recentes, resultados financeiros com numeros, recomendacao de analistas e preco-alvo.`)
    .join('\n\n');

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
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Voce e um analista financeiro senior. Pesquise noticias de hoje e gere um briefing em portugues com estas secoes (use os titulos exatos em maiusculas):\n\nMERCADO HOJE\nResumo do Ibovespa: pontuacao, variacao, destaques do dia.\n\nCENARIO BRASIL\nSELIC, inflacao, cambio, politica fiscal.\n\nCENARIO GLOBAL\nFed, China, commodities, impactos no Brasil.\n\n${stocksPrompt}\n\nData atual: ${date}. Seja especifico com numeros e cite fontes.`
        }]
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
