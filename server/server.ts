import express from 'express';
import cors from 'cors';
import { simulateRoute } from './routes/simulate';
import { strategiesRoute } from './routes/strategies';

const PORT = 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/simulate', simulateRoute);
app.get('/api/strategies', strategiesRoute);

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
