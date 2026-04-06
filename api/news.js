const GNEWS_BASE = 'https://gnews.io/api/v4/search';

const SECTOR_QUERIES = {
  bancos:    '"Itaú" OR "Bradesco" OR "Banco do Brasil" OR "Santander" OR "juros" OR "SELIC" OR "Copom"',
  energia:   '"Petrobras" OR "petróleo" OR "OPEP" OR "combustível" OR "pré-sal" OR "gás natural"',
  mineracao: '"Vale" OR "minério de ferro" OR "soja" OR "milho" OR "exportação" OR "agronegócio"',
  varejo:    '"Magazine Luiza" OR "Americanas" OR "consumo" OR "varejo" OR "e-commerce" OR "vendas"',
  utilities: '"Eletrobras" OR "Sabesp" OR "energia elétrica" OR "ANEEL" OR "saneamento"'
};

async function fetchGNews(query, apiKey, max = 6) {
  const url = `${GNEWS_BASE}?q=${encodeURIComponent(query)}&lang=pt&max=${max}&sortby=publishedAt&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0] || `GNews erro ${res.status}`);
  }
  const data = await res.json();
  return data.articles || [];
}

async function analyzeWithClaude(articles, context, apiKey) {
  if (!articles.length) return articles.map(() => ({ sentimento: 'NEUTRO', urgencia: 'BAIXO', analise: '' }));

  const list = articles.map((a, i) =>
    `${i + 1}. "${a.title}" — ${a.description || 'sem descricao'} (${a.source?.name || 'fonte desconhecida'})`
  ).join('\n');

  const prompt = `Voce e um analista financeiro senior especializado no mercado brasileiro (B3). Analise as noticias sobre ${context} e responda no formato EXATO abaixo para cada noticia:

NOTICIA 1
SENTIMENTO: POSITIVO
URGENCIA: ALTO
ANALISE: [Paragrafo detalhado explicando: o que aconteceu, por que importa para o mercado brasileiro, quais setores ou acoes da B3 podem ser afetados e como, projecao de curto prazo]

NOTICIA 2
SENTIMENTO: NEGATIVO
URGENCIA: MEDIO
ANALISE: [...]

Use apenas POSITIVO, NEGATIVO ou NEUTRO para sentimento. Use apenas ALTO, MEDIO ou BAIXO para urgencia.

Noticias:
${list}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

  return articles.map((_, i) => {
    const n = i + 1;
    const block = text.match(
      new RegExp(`NOTICIA\\s+${n}\\s+SENTIMENTO:\\s*(\\w+)\\s+URGENCIA:\\s*(\\w+)\\s+ANALISE:\\s*([\\s\\S]*?)(?=NOTICIA\\s+${n + 1}|$)`, 'i')
    );
    if (block) {
      return {
        sentimento: block[1].trim().toUpperCase(),
        urgencia: block[2].trim().toUpperCase(),
        analise: block[3].trim()
      };
    }
    return { sentimento: 'NEUTRO', urgencia: 'BAIXO', analise: '' };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const gnewsKey = process.env.GNEWS_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!gnewsKey) return res.status(500).json({ error: 'GNEWS_API_KEY not configured' });
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { type, query } = req.body;

  try {
    if (type === 'global') {
      const q = '"Brasil" "economia" OR "Ibovespa" OR "IPCA" OR "Selic" OR "mercado financeiro" OR "Federal Reserve" OR "petróleo" OR "dólar" OR "commodities"';
      const articles = await fetchGNews(q, gnewsKey, 8);
      const analyses = await analyzeWithClaude(articles, 'o mercado financeiro brasileiro e global', anthropicKey);
      return res.json({ articles: articles.map((a, i) => ({ ...a, ...analyses[i] })) });
    }

    if (type === 'sector') {
      const q = SECTOR_QUERIES[query];
      if (!q) return res.status(400).json({ error: 'Setor invalido' });
      const articles = await fetchGNews(q, gnewsKey, 5);
      const analyses = await analyzeWithClaude(articles, `o setor ${query}`, anthropicKey);
      return res.json({ articles: articles.map((a, i) => ({ ...a, ...analyses[i] })) });
    }

    if (type === 'stock') {
      const articles = await fetchGNews(query, gnewsKey, 4);
      const analyses = await analyzeWithClaude(articles, query, anthropicKey);
      return res.json({ articles: articles.map((a, i) => ({ ...a, ...analyses[i] })) });
    }

    return res.status(400).json({ error: 'type invalido' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
