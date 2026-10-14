import os
import pickle

import pandas as pd
import xgboost as xgb
from flask import Flask, jsonify, render_template, request
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import (
    ElasticNet,
    HuberRegressor,
    Lasso,
    LinearRegression,
    Ridge,
    SGDRegressor,
)
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures
from sklearn.svm import SVR

MODEL_NAMES = [
    'LinearRegression',
    'RobustRegression',
    'RidgeRegression',
    'LassoRegression',
    'ElasticNet',
    'PolynomialRegression',
    'SGDRegressor',
    'ANN',
    'RandomForest',
    'SVM',
    'XGBoost',
    'KNN',
]

FEATURE_COLUMNS = [
    'Avg. Area Income',
    'Avg. Area House Age',
    'Avg. Area Number of Rooms',
    'Avg. Area Number of Bedrooms',
    'Area Population',
]


def train_and_evaluate_models():
    data = pd.read_csv(r"C:\Users\Admin\Downloads\USA_Housing.csv")
    X = data.drop(['Price', 'Address'], axis=1)
    y = data['Price']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)

    models = {
        'LinearRegression': LinearRegression(),
        'RobustRegression': HuberRegressor(),
        'RidgeRegression': Ridge(),
        'LassoRegression': Lasso(),
        'ElasticNet': ElasticNet(),
        'PolynomialRegression': Pipeline([
            ('poly', PolynomialFeatures(degree=4)),
            ('linear', LinearRegression()),
        ]),
        'SGDRegressor': SGDRegressor(),
        'ANN': MLPRegressor(hidden_layer_sizes=(100,), max_iter=1000),
        'RandomForest': RandomForestRegressor(random_state=42),
        'SVM': SVR(),
        'XGBoost': xgb.XGBRegressor(random_state=42),
        'KNN': KNeighborsRegressor(),
    }

    results = []
    for name, model in models.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        mse = mean_squared_error(y_test, y_pred)
        rmse = mean_squared_error(y_test, y_pred) ** 0.5
        r2 = r2_score(y_test, y_pred)

        results.append({
            'Model': name,
            'MAE': float(mae),
            'MSE': float(mse),
            'RMSE': float(rmse),
            'R2': float(r2),
        })

        with open(f"{name}.pkl", 'wb') as file:
            pickle.dump(model, file)

    results_df = pd.DataFrame(results).sort_values('R2', ascending=False).reset_index(drop=True)
    results_df.to_csv('model_evaluation_results.csv', index=False)
    return results_df


def load_saved_models():
    models = {}
    for model_name in MODEL_NAMES:
        file_path = f'{model_name}.pkl'
        if os.path.exists(file_path):
            with open(file_path, 'rb') as file:
                models[model_name] = pickle.load(file)
    return models


if not os.path.exists('model_evaluation_results.csv') or not all(os.path.exists(f'{name}.pkl') for name in MODEL_NAMES):
    results_df = train_and_evaluate_models()
else:
    results_df = pd.read_csv('model_evaluation_results.csv')

models = load_saved_models()
app = Flask(__name__)


def build_prediction_input(form_data):
    return {
        'Avg. Area Income': float(form_data.get('Avg. Area Income', 0)),
        'Avg. Area House Age': float(form_data.get('Avg. Area House Age', 0)),
        'Avg. Area Number of Rooms': float(form_data.get('Avg. Area Number of Rooms', 0)),
        'Avg. Area Number of Bedrooms': float(form_data.get('Avg. Area Number of Bedrooms', 0)),
        'Area Population': float(form_data.get('Area Population', 0)),
    }


def format_currency(value):
    return f"${value:,.2f}"


@app.route('/')
def index():
    best_model = results_df.sort_values('R2', ascending=False).iloc[0].to_dict() if not results_df.empty else {}
    return render_template(
        'dashboard.html',
        model_names=MODEL_NAMES,
        results=results_df.to_dict(orient='records'),
        best_model=best_model,
    )


@app.route('/api/predict', methods=['POST'])
def api_predict():
    data = request.get_json(silent=True) or request.form.to_dict()
    model_name = data.get('model', MODEL_NAMES[0])
    if model_name not in models:
        return jsonify({'error': 'Model not found'}), 400

    input_df = pd.DataFrame([build_prediction_input(data)])
    prediction = float(models[model_name].predict(input_df)[0])
    return jsonify({
        'model': model_name,
        'prediction': round(prediction, 2),
        'formatted': format_currency(prediction),
    })


@app.route('/predict', methods=['POST'])
def predict():
    result = api_predict()
    if result.status_code != 200:
        return result
    payload = result.get_json()
    return render_template('results.html', prediction=payload['formatted'], model_name=payload['model'])


@app.route('/results')
def results():
    return render_template('model.html', tables=[results_df.to_html(classes='data')], titles=results_df.columns.values)


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)