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

        // 3. Processa e busca odds com Fallback de Casas de Apostas
        const resultadoFinal = await Promise.all(jogosFiltrados.map(async (jogo) => {
            let oddTexto = "Indisponível";

            try {
                // Busca odds da partida sem restringir bookmaker na chamada principal
                const resOdds = await axios.get(`${API_URL}/odds`, {
                    params: { fixture: jogo.fixture.id },
                    headers: { 'x-apisports-key': API_KEY }
                });

                const bookmakers = resOdds.data.response[0]?.bookmakers || [];

                // Tenta priorizar Bet365 (id 6), se não existir pega a primeira disponível
                const casaSelecionada = bookmakers.find(b => b.id === 6) || bookmakers[0];

                if (casaSelecionada) {
                    const mercado1X2 = casaSelecionada.bets?.find(b => b.id === 1); // Mercado Match Winner
                    if (mercado1X2) {
                        oddTexto = `[${casaSelecionada.name}] ` + mercado1X2.values.map(v => `${v.value}: ${v.odd}`).join(' | ');
                    }
                }
            } catch (err) {
                // Se der erro nas odds de um jogo, mantém "Indisponível" sem travar
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
    app.listen(PORT, () => console.log(`Middleware rodando na porta ${PORT}`));
}
