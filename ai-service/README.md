# Farm-to-Fork AI Microservice 🤖🌱

This is a dedicated Python FastAPI microservice that powers the **AI Agronomist and Market Price Predictor** for the Farm-to-Fork Tracker platform. It uses machine learning to forecast agricultural commodity prices based on real historical data.

## 🏗️ Architecture

- **Framework**: FastAPI (Python 3.x)
- **Machine Learning**: XGBoost Regressor (`xgboost`, `scikit-learn`)
- **Data Processing**: Pandas, NumPy
- **Database Connection**: Supabase PostgreSQL (`supabase-py`)

## 🧠 How the AI Works

1. **Data Pipeline (`ml/preprocessing.py`)**: Pulls historical pricing data (like Agmarknet data) directly from Supabase. Cleanses missing values, enforces chronological sorting, and maps columns to a standard schema.
2. **Feature Engineering (`ml/feature_engineering.py`)**: Computes advanced time-series metrics: rolling averages, historical lags (`lag_7`, `lag_30`), day-of-year indicators, and market momentum without causing future data leakage.
3. **Training Engine (`ml/train_price_model.py`)**: Splits data strictly chronologically (Train/Val/Test). Trains an `XGBRegressor` using early stopping. Saves `model.pkl`, `preprocessor.pkl`, and `metadata.json`.
4. **Prediction Service (`services/price_prediction_service.py`)**: Loads the serialized model into memory once. Accepts real-time inference requests and uses a recursive prediction loop to project market prices up to 14 days into the future.
5. **API Layer (`main.py`)**: Exposes RESTful endpoints consumed by the React frontend.

## 🚀 Local Development Setup

1. **Install Dependencies**
   ```bash
   cd ai-service
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the `ai-service/` directory:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```
   *(Note: Without `.env`, the service will safely fall back to using static CSV data from `data/test_clean.csv`).*

3. **Run the Server**
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

## ☁️ Deployment (Render)

This service must be deployed as a dedicated **Python 3 Web Service**, entirely separate from the Node.js backend.

1. Create a **New Web Service** in Render.
2. Connect your Git repository.
3. Settings:
   - **Root Directory**: `ai-service`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Render Environment Variables.
5. Once deployed, take the Render URL (e.g., `https://farm-ai-service.onrender.com`) and add it to your React Frontend's environment variables as `VITE_AI_API_URL`.

## 🧪 Retraining the Model

To retrain the ML model on fresh historical data:
```bash
cd ai-service
python -m ml.train_price_model
```
This will output a new evaluation report to the console and update the `.pkl` artifacts in the `models/` directory. Restart the server to load the new weights!
