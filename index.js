const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_URL = 'https://v3.football.api-sports.io';

// IDs das Ligas Monitoradas (Brasileirão, PL, LaLiga, Serie A, Champions, Liberta)
const LIGAS_MONITORADAS = [71, 39, 140, 135, 2, 13];

app.get('/mesa-jogos', async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        
        // 1. Busca os jogos do dia na API-Football
        const responseFixtures = await axios.get(`${API_URL}/fixtures`, {
            params: { date: date, season: 2026 },
            headers: { 'x-apisports-key': API_KEY }
        });

        const jogos = responseFixtures.data.response || [];

        // 2. Filtra APENAS as LIGAS MONITORADAS em memória
        const jogosFiltrados = jogos.filter(item => 
            LIGAS_MONITORADAS.includes(item.league.id)
        );

        // 3. Processa e busca odds leves (Bet365 - bookmaker 6)
        const resultadoFinal = await Promise.all(jogosFiltrados.map(async (jogo) => {
            let oddBet365 = "Indisponível";

            try {
                const resOdds = await axios.get(`${API_URL}/odds`, {
                    params: { fixture: jogo.fixture.id, bookmaker: 6 },
                    headers: { 'x-apisports-key': API_KEY }
                });

                const oddsData = resOdds.data.response[0]?.bookmakers[0]?.bets;
                const mercado1X2 = oddsData?.find(b => b.id === 1); // Mercado Match Winner

                if (mercado1X2) {
                    oddBet365 = mercado1X2.values.map(v => `${v.value}: ${v.odd}`).join(' | ');
                }
            } catch (err) {
                // Se der erro nas odds de um jogo, não trava o restante
            }

            return {
                id_partida: jogo.fixture.id,
                horario_utc: jogo.fixture.date,
                campeonato: jogo.league.name,
                confronto: `${jogo.teams.home.name} x ${jogo.teams.away.name}`,
                odds_1X2: oddBet365
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
    app.listen(PORT, () => console.log(`Middleware rodando na porta ${PORT}`));
}
