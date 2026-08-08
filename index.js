const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = 'https://v3.football.api-sports.io';

// ==========================================
// 1. LISTA DE LIGAS MONITORADAS (Campeonatos)
// ==========================================
const LIGAS_MONITORADAS = [
  // Brasil
  71, 72, 73,      // Série A, Série B, Copa do Brasil
  // Continentais
  13, 11, 16, 847, // Libertadores, Sul-Americana, CONCACAF Champions Cup, Leagues Cup
  2, 3, 848,       // Champions League, Europa League, Conference
  // Américas
  253, 262,        // MLS, Liga MX
  128, 130,        // Argentina (Liga e Copa)
  265, 267,        // Chile (Primera e Copa)
  239, 242,        // Colômbia (Primera A e Copa)
  244,             // Equador (Copa) - LigaPro Serie A usa ID 242
  250, 252,        // Paraguai (División e Copa)
  253, 255,        // Bolívia (División e Copa)
  268,             // Uruguai (Primera)
  // Europa
  39, 45, 48,      // Premier League, FA Cup, EFL Cup
  140, 143,        // LaLiga, Copa del Rey
  135, 137,        // Serie A Itália, Coppa Italia
  78, 81,          // Bundesliga, DFB-Pokal
  61, 66,          // Ligue 1, Coupe de France
  94, 96,          // Liga Portugal, Taça
  88, 90,          // Eredivisie, KNVB Beker
  144, 147,        // Pro League Bélgica, Croky Cup
  179, 183         // Premiership Escócia, Scottish Cup
];

// ==========================================
// 2. LISTA DE TIMES DE ELITE (Elite)
// ==========================================
const TIMES_ELITE = [
  // Brasil
  127, 121, 126, 131, 1062, 119, 130, 120, 124, 125,
  // Bolívia
  1118,
  // Argentina
  435, 451, 436, 434, 448,
  // Chile
  1100, 1092, 1103,
  // Colômbia
  1136, 1129, 1139, 1126,
  // Equador
  1158, 1148, 1150,
  // Escócia
  247, 252,
  // Uruguai
  1166, 1165,
  // USA (MLS)
  15949, 1600, 1595, 1611, 1606,
  // México
  2287, 2279, 2278, 2280,
  // Inglaterra
  50, 40, 42, 33, 49,
  // Espanha
  541, 529, 530,
  // Itália
  505, 496, 489, 492, 497,
  // Alemanha
  157, 168, 165, 173,
  // França
  85, 81, 91,
  // Portugal
  211, 228, 212,
  // Holanda
  194, 197, 195
];

app.get('/mesa-jogos', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const modo = (req.query.modo || 'campeonatos').toLowerCase(); // Padrão: campeonatos

        // 1. Busca os jogos do dia na API-Football
        const responseFixtures = await axios.get(`${API_URL}/fixtures`, {
            params: { date: date, season: 2026 },
            headers: { 'x-apisports-key': API_KEY }
        });

        const jogos = responseFixtures.data.response || [];
        let jogosFiltrados = [];

        // 2. Lógica de Seleção baseada nas Palavras-Chave
        if (modo === 'elite') {
            jogosFiltrados = jogos.filter(item => 
                TIMES_ELITE.includes(item.teams.home.id) || 
                TIMES_ELITE.includes(item.teams.away.id)
            );
        } else {
            // Modo Padrão: Campeonatos
            jogosFiltrados = jogos.filter(item => 
                LIGAS_MONITORADAS.includes(item.league.id)
            );
        }

        // Limite de segurança de 30 jogos por resposta
        const jogosLimitados = jogosFiltrados.slice(0, 30);

        // 3. Processamento de Odds com Fallback
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
                // Preserva o fluxo contínuo
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
            modo_utilizado: modo,
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
