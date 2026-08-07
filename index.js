const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = 'https://v3.football.api-sports.io';

// IDs das Ligas Selecionadas (Incluindo Uruguai)
const LIGAS_MONITORADAS = [
  // Brasil
  71, 72, 73,      // Série A, Série B, Copa do Brasil

  // Internacionais & Continentais
  13, 11,          // Libertadores, Sul-Americana
  2, 3, 848,       // Champions League, Europa League, Conference

  // Inglaterra
  39, 40, 45,      // Premier League, EFL Championship, FA Cup

  // Espanha
  140, 141, 143,   // LaLiga, LaLiga Hypermotion, Copa del Rey

  // Itália
  135, 136, 137,   // Serie A, Serie B, Coppa Italia

  // Alemanha
  78, 79, 81,      // Bundesliga, 2. Bundesliga, DFB-Pokal

  // França
  61, 62, 66,      // Ligue 1, Ligue 2, Coupe de France

  // Portugal
  94, 95, 96,      // Liga Portugal, Liga Portugal 2, Taça de Portugal

  // Holanda
  88, 89, 90,      // Eredivisie, Eerste Divisie, KNVB Beker

  // Bélgica
  144, 145, 147,   // Pro League, Challenger Pro, Croky Cup

  // Escócia
  179, 180, 183,   // Premiership, Championship, Scottish Cup

  // Argentina
  128, 129, 130,   // Liga Profesional, Primera Nacional, Copa Argentina

  // Arábia Saudita
  307, 308, 310,   // Saudi Pro League, First Division, King's Cup

  // Chile
  265, 266, 267,   // Primera División, Primera B, Copa Chile

  // Colômbia
  239, 240, 242,   // Primera A, Primera B, Copa Colombia

  // Equador
  242, 243, 244,   // LigaPro Serie A, Serie B, Copa Ecuador

  // Paraguai
  250, 251, 252,   // División de Honor, Intermedia, Copa Paraguay

  // Bolívia
  253, 254, 255,   // División Profesional, Copa Simón Bolívar, Copa Bolivia

  // Uruguai
  268              // Primera División
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

        // Limita a no máximo 30 jogos por consulta para resposta fluida no ChatGPT
        const jogosLimitados = jogosFiltrados.slice(0, 30);

        // 3. Processa e busca odds com Fallback
        const resultadoFinal = await Promise.all(jogosLimitados.map(async (jogo) => {
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
                // Em caso de erro na busca de odds, mantém o texto padrão sem interromper a execução
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
            total_jogos_exibidos: resultadoFinal.length,
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
