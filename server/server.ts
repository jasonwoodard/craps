import express from 'express';
import cors from 'cors';
import { simulateRoute } from './routes/simulate';
import { strategiesRoute } from './routes/strategies';
import { distributionStreamRoute } from './routes/distribution';
import { sessionCompareRoute } from './routes/session-compare';
import { distributionCompareStreamRoute } from './routes/distribution-compare';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/simulate', simulateRoute);
app.get('/api/strategies', strategiesRoute);
app.get('/api/distribution/stream', distributionStreamRoute);
app.post('/api/session-compare', sessionCompareRoute);
app.get('/api/distribution-compare/stream', distributionCompareStreamRoute);

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
