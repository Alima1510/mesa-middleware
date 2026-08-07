const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = 'https://v3.football.api-sports.io';

// IDs das Ligas Selecionadas (Conforme Tabela Revisada)
const LIGAS_MONITORADAS = [
  // Brasil
  71, 72, 73,      // Série A, Série B, Copa do Brasil

  // Internacionais & Continentais
  13, 11,          // Libertadores, Sul-Americana
  2, 3, 848,       // Champions League, Europa League, Conference
  16, 847,         // CONCACAF Champions Cup, Leagues Cup

  // Inglaterra
  39, 45, 48,      // Premier League, FA Cup, EFL Cup (Carabao Cup)

  // Espanha
  140, 143,        // LaLiga, Copa del Rey

  // Itália
  135, 137,        // Serie A, Coppa Italia

  // Alemanha
  78, 81,          // Bundesliga, DFB-Pokal

  // França
  61, 66,          // Ligue 1, Coupe de France

  // Portugal
  94, 96,          // Liga Portugal, Taça de Portugal

  // Holanda
  88, 90,          // Eredivisie, KNVB Beker

  // Bélgica
  144, 147,        // Pro League, Croky Cup

  // Escócia
  179, 183,        // Premiership, Scottish Cup

  // Argentina
  128, 130,        // Liga Profesional, Copa Argentina

  // Chile
  265, 267,        // Primera División, Copa Chile

  // Colômbia
  239, 242,        // Primera A, Copa Colombia

  // Equador
  242, 244,        // LigaPro Serie A, Copa Ecuador

  // Paraguai
  250, 252,        // División de Honor, Copa Paraguay

  // Bolívia
  253, 255,        // División Profesional, Copa Bolivia

  // Uruguai
  268,             // Primera División

  // USA & México
  253,             // MLS (Major League Soccer)
  262              // Liga MX (Primeira Divisão)
];

app.get('/mesa-jogos', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        
        // 1. Busca os jogos do dia na API-Football
        const responseFixtures = await axios.get(`${API_URL}/fixtures`, {
            params: { date: date, season: 2026 },
            headers: { 'x-apisports-key': API_KEY }
        });

        const jogos = responseFixtures.data.response || [];

        // 2. Filtra pelas Ligas Monitoradas
        const jogosFiltrados = jogos.filter(item => 
            LIGAS_MONITORADAS.includes(item.league.id)
        );

        // 3. Processa e busca odds com Fallback Inteligente
        const resultadoFinal = await Promise.all(jogosFiltrados.map(async (jogo) => {
            let oddTexto = "Aguardando Cotação";

            try {
                const resOdds = await axios.get(`${API_URL}/odds`, {
                    params: { fixture: jogo.fixture.id },
                    headers: { 'x-apisports-key': API_KEY }
                });

                const responseOddsData = resOdds.data.response || [];

                if (responseOddsData.length > 0) {
                    const bookmakers = responseOddsData[0].bookmakers || [];
                    const casaSelecionada = bookmakers.find(b => b.id === 6) || bookmakers[0];

                    if (casaSelecionada && casaSelecionada.bets) {
                        const mercado1X2 = casaSelecionada.bets.find(b => b.id === 1);
                        if (mercado1X2 && mercado1X2.values) {
                            const cotacoes = mercado1X2.values.map(v => `${v.value}: ${v.odd}`).join(' | ');
                            oddTexto = `[${casaSelecionada.name}] ${cotacoes}`;
                        }
                    }
                }
            } catch (err) {
                // Em caso de erro na busca de odds de um jogo específico, não interrompe a execução
            }

            return {
                id_partida: jogo.fixture.id,
                horario_utc: jogo.fixture.date,
                campeonato: jogo.league.name,
                confronto: `${jogo.teams.home.name} x ${jogo.teams.away.name}`,
                odds_1X2: oddTexto
            };
        }));

        res.json({
            data_consulta: date,
            total_jogos_encontrados: jogosFiltrados.length,
            partidas: resultadoFinal
        });

    } catch (error) {
        res.status(500).json({ 
            erro: "Falha ao processar partidas no middleware", 
            detalhe: error.message 
        });
    }
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Middleware MESA rodando na porta ${PORT}`));
}
