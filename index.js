const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = 'https://v3.football.api-sports.io';

// Mapeamento de Ligas por Região
const LIGAS_AMERICAS = [71, 72, 73, 13, 11, 16, 847, 253, 262, 128, 130, 265, 267, 239, 242, 244, 250, 252, 255, 268];
const LIGAS_EUROPA = [2, 3, 848, 39, 45, 48, 140, 143, 135, 137, 78, 81, 61, 66, 94, 96, 88, 90, 144, 147, 179, 183];
const LIGAS_TODAS = [...LIGAS_AMERICAS, ...LIGAS_EUROPA];

// IDs dos Times de Elite
const TIMES_ELITE = [
  127, 121, 126, 131, 1062, 119, 130, 120, 124, 125, // Brasil
  1118, // Bolívia
  435, 451, 436, 434, 448, // Argentina
  1100, 1092, 1103, // Chile
  1136, 1129, 1139, 1126, // Colômbia
  1158, 1148, 1150, // Equador
  247, 252, // Escócia
  1166, 1165, // Uruguai
  15949, 1600, 1595, 1611, 1606, // USA
  2287, 2279, 2278, 2280, // México
  50, 40, 42, 33, 49, // Inglaterra
  541, 529, 530, // Espanha
  505, 496, 489, 492, 497, // Itália
  157, 168, 165, 173, // Alemanha
  85, 81, 91, // França
  211, 228, 212, // Portugal
  194, 197, 195 // Holanda
];

app.get('/mesa-jogos', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const modo = (req.query.modo || 'campeonatos').toLowerCase();
        const regiao = (req.query.regiao || 'todas').toLowerCase();

        // 1. Busca os jogos do dia na API-Football
        const responseFixtures = await axios.get(`${API_URL}/fixtures`, {
            params: { date: date, season: 2026 },
            headers: { 'x-apisports-key': API_KEY }
        });

        const jogos = responseFixtures.data.response || [];
        let jogosFiltrados = [];

        // 2. Aplica o Filtro de Modo (Campeonatos ou Elite)
        if (modo === 'elite') {
            jogosFiltrados = jogos.filter(item => 
                TIMES_ELITE.includes(item.teams.home.id) || 
                TIMES_ELITE.includes(item.teams.away.id)
            );
        } else {
            jogosFiltrados = jogos.filter(item => 
                LIGAS_TODAS.includes(item.league.id)
            );
        }

        // 3. Aplica o Filtro de Região ANTES do limite de 30 jogos
        if (regiao === 'americas') {
            jogosFiltrados = jogosFiltrados.filter(item => LIGAS_AMERICAS.includes(item.league.id));
        } else if (regiao === 'europa') {
            jogosFiltrados = jogosFiltrados.filter(item => LIGAS_EUROPA.includes(item.league.id));
        }

        // 4. Agora sim aplica o corte de segurança de até 30 jogos (já 100% filtrados da região)
        const jogosLimitados = jogosFiltrados.slice(0, 30);

        // 5. Processamento das Odds
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
            } catch (err) {}

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
            regiao_filtrada: regiao,
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
