const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = 'https://v3.football.api-sports.io';

// IDs de TODOS os Campeonatos da Tabela do MESA (Ampliados)
const LIGAS_MONITORADAS = [
  // Torneios Continentais / Internacionais
  2, 3, 848,     // UEFA Champions, Europa League, Conference
  13, 11,        // Copa Libertadores, Copa Sul-Americana
  17, 18,        // AFC Champions League Elite, AFC Cup

  // Brasil
  71, 72, 73,    // Série A, Série B, Copa do Brasil

  // Inglaterra
  39, 40, 45,    // Premier League, Championship, FA Cup

  // Espanha
  140, 141, 143, // LaLiga, LaLiga Hypermotion, Copa del Rey

  // Itália
  135, 136, 137, // Serie A, Serie B, Coppa Italia

  // Alemanha
  78, 79, 81,    // Bundesliga, 2. Bundesliga, DFB-Pokal

  // França
  61, 62, 66,    // Ligue 1, Ligue 2, Coupe de France

  // Portugal
  94, 95, 96,    // Liga Portugal, Liga Portugal 2, Taça de Portugal

  // Holanda
  88, 89, 90,    // Eredivisie, Eerste Divisie, KNVB Beker

  // Bélgica
  144, 145, 147, // Pro League, Challenger Pro, Croky Cup

  // Escócia
  179, 180, 183, // Premiership, Championship, Scottish Cup

  // Grécia
  197, 198, 200, // Super League 1, Super League 2, Greek Cup

  // Áustria
  218, 219, 221, // Bundesliga, 2. Liga, ÖFB-Cup

  // Hungria
  271, 272, 273, // NB I, NB II, Magyar Kupa

  // Argentina
  128, 129, 130, // Liga Profesional, Primera Nacional, Copa Argentina

  // Arábia Saudita
  307, 308, 310, // Saudi Pro League, First Division, King's Cup

  // Chile
  265, 266, 267, // Primera División, Primera B, Copa Chile

  // Colômbia
  239, 240, 241, // Primera A, Primera B, Copa Colombia

  // Equador
  242, 243, 244, // LigaPro Serie A, Serie B, Copa Ecuador

  // Paraguai
  250, 251, 252, // División de Honor, Intermedia, Copa Paraguay

  // Bolívia
  253, 254, 255  // División Profesional, Copa Simón Bolívar, Copa Bolivia
];

app.get('/mesa-jogos', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        
        // 1. Busca todos os jogos do dia
        const responseFixtures = await axios.get(`${API_URL}/fixtures`, {
            params: { date: date, season: 2026 },
            headers: { 'x-apisports-key': API_KEY }
        });

        const jogos = responseFixtures.data.response || [];

        // 2. Filtra pelas ligas monitoradas
        const jogosFiltrados = jogos.filter(item => 
            LIGAS_MONITORADAS.includes(item.league.id)
        );

        // 3. Processa e busca odds com FALLBACK COMPLETO
        const resultadoFinal = await Promise.all(jogosFiltrados.map(async (jogo) => {
            let oddTexto = "Indisponível";

            try {
                // Tenta consultar as odds da partida sem travar em bookmaker específico na URL
                const resOdds = await axios.get(`${API_URL}/odds`, {
                    params: { fixture: jogo.fixture.id },
                    headers: { 'x-apisports-key': API_KEY }
                });

                const responseOddsData = resOdds.data.response || [];

                if (responseOddsData.length > 0) {
                    const bookmakers = responseOddsData[0].bookmakers || [];
                    
                    // Prioridade 1: Bet365 (id 6) | Prioridade 2: Primeira casa disponível
                    const casaSelecionada = bookmakers.find(b => b.id === 6) || bookmakers[0];

                    if (casaSelecionada && casaSelecionada.bets) {
                        // Busca o mercado 1X2 (Match Winner - id 1)
                        const mercado1X2 = casaSelecionada.bets.find(b => b.id === 1);
                        if (mercado1X2 && mercado1X2.values) {
                            const cotações = mercado1X2.values.map(v => `${v.value}: ${v.odd}`).join(' | ');
                            oddTexto = `[${casaSelecionada.name}] ${cotações}`;
                        }
                    }
                }
            } catch (err) {
                // Se falhar a busca de odds de um jogo, o middleware não quebra
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
            total_jogos: resultadoFinal.length,
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
