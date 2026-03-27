import express from 'express';
import cors from 'cors';
import { simulateRoute } from './routes/simulate';
import { strategiesRoute } from './routes/strategies';
import { distributionStreamRoute } from './routes/distribution';
import { compareRoute } from './routes/compare';

const PORT = 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/simulate', simulateRoute);
app.get('/api/strategies', strategiesRoute);
app.get('/api/distribution/stream', distributionStreamRoute);
app.post('/api/compare', compareRoute);

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
