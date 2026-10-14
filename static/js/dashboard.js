const resultsData = JSON.parse(document.getElementById('resultsData').textContent || '[]');
const form = document.getElementById('predictionForm');
const modelSelect = document.getElementById('modelSelect');
const sampleDataBtn = document.getElementById('sampleDataBtn');
const predictedPrice = document.getElementById('predictedPrice');
const resultModelText = document.getElementById('resultModelText');
const benchmarkBody = document.getElementById('benchmarkBody');

const validResults = resultsData.filter((row) => {
  const mae = Number(row.MAE);
  const rmse = Number(row.RMSE);
  const r2 = Number(row.R2);

  return (
    Number.isFinite(mae) &&
    Number.isFinite(rmse) &&
    Number.isFinite(r2) &&
    mae > 0 &&
    rmse > 0 &&
    mae < 1_000_000 &&
    rmse < 1_000_000 &&
    Math.abs(r2) < 1_000_000
  );
});

const formatCurrency = (value) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatCompact = (value, digits = 2) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  if (Math.abs(num) >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: digits })}B`;
  }
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: digits })}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${(num / 1_000).toLocaleString(undefined, { maximumFractionDigits: digits })}K`;
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
};
const formatNumber = (value, digits = 2) => Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

function renderStats() {
  if (!validResults.length) return;

  const sorted = [...validResults].sort((a, b) => Number(b.R2) - Number(a.R2));
  const best = sorted[0];
  const avgMae = validResults.reduce((sum, item) => sum + Number(item.MAE), 0) / validResults.length;
  const avgRmse = validResults.reduce((sum, item) => sum + Number(item.RMSE), 0) / validResults.length;

  document.getElementById('bestModelName').textContent = best.Model;
  document.getElementById('bestModelScore').textContent = `R² ${formatNumber(best.R2, 3)}`;
  document.getElementById('avgMae').textContent = formatCompact(avgMae, 2);
  document.getElementById('avgRmse').textContent = formatCompact(avgRmse, 2);
  document.getElementById('modelCount').textContent = String(validResults.length);
}

function renderBenchmark() {
  benchmarkBody.innerHTML = validResults
    .slice()
    .sort((a, b) => Number(b.R2) - Number(a.R2))
    .map((row) => `
      <tr>
        <td><strong>${row.Model}</strong></td>
        <td>${formatCompact(row.MAE, 2)}</td>
        <td>${formatCompact(row.RMSE, 2)}</td>
        <td>${formatNumber(row.R2, 3)}</td>
      </tr>
    `)
    .join('');
}

function renderCharts() {
  if (!window.Chart || !validResults.length) return;

  const topModels = validResults.slice().sort((a, b) => Number(b.R2) - Number(a.R2)).slice(0, 6);
  const r2ChartCtx = document.getElementById('r2Chart');
  const rmseChartCtx = document.getElementById('rmseChart');

  new Chart(r2ChartCtx, {
    type: 'bar',
    data: {
      labels: topModels.map((item) => item.Model),
      datasets: [{
        label: 'R² score',
        data: topModels.map((item) => Number(item.R2)),
        backgroundColor: 'rgba(124, 156, 255, 0.7)',
        borderRadius: 10,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { color: '#9aa8bd' },
          grid: { color: 'rgba(148, 163, 184, 0.12)' }
        },
        x: {
          ticks: { color: '#9aa8bd', maxRotation: 35, minRotation: 0 },
          grid: { display: false }
        }
      }
    }
  });

  new Chart(rmseChartCtx, {
    type: 'line',
    data: {
      labels: topModels.map((item) => item.Model),
      datasets: [{
        label: 'RMSE',
        data: topModels.map((item) => Number(item.RMSE)),
        borderColor: '#6ee7d4',
        backgroundColor: 'rgba(110, 231, 212, 0.18)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#6ee7d4'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { color: '#9aa8bd' },
          grid: { color: 'rgba(148, 163, 184, 0.12)' }
        },
        x: {
          ticks: { color: '#9aa8bd', maxRotation: 35, minRotation: 0 },
          grid: { display: false }
        }
      }
    }
  });
}

function getSampleInput() {
  return {
    model: modelSelect.value,
    'Avg. Area Income': 65000,
    'Avg. Area House Age': 5.5,
    'Avg. Area Number of Rooms': 6.0,
    'Avg. Area Number of Bedrooms': 3.0,
    'Area Population': 12000,
  };
}

function updatePredictionDisplay(payload) {
  predictedPrice.textContent = payload.formatted;
  resultModelText.textContent = `Selected model: ${payload.model}`;
}

sampleDataBtn.addEventListener('click', () => {
  const sample = getSampleInput();
  modelSelect.value = sample.model;
  document.getElementById('avgAreaIncome').value = sample['Avg. Area Income'];
  document.getElementById('avgAreaHouseAge').value = sample['Avg. Area House Age'];
  document.getElementById('avgAreaRooms').value = sample['Avg. Area Number of Rooms'];
  document.getElementById('avgAreaBedrooms').value = sample['Avg. Area Number of Bedrooms'];
  document.getElementById('areaPopulation').value = sample['Area Population'];
});

async function submitPrediction() {
  const payload = {
    model: modelSelect.value,
    'Avg. Area Income': Number(document.getElementById('avgAreaIncome').value),
    'Avg. Area House Age': Number(document.getElementById('avgAreaHouseAge').value),
    'Avg. Area Number of Rooms': Number(document.getElementById('avgAreaRooms').value),
    'Avg. Area Number of Bedrooms': Number(document.getElementById('avgAreaBedrooms').value),
    'Area Population': Number(document.getElementById('areaPopulation').value),
  };

  const response = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Prediction failed.');
    return;
  }

  updatePredictionDisplay(data);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await submitPrediction();
});

['input', 'change'].forEach((eventName) => {
  form.addEventListener(eventName, () => {
    const values = Array.from(form.querySelectorAll('input, select'))
      .map((field) => field.value)
      .filter((value) => value !== '');

    if (values.length >= 5) {
      setTimeout(submitPrediction, 150);
    }
  });
});

renderStats();
renderBenchmark();
renderCharts();
updatePredictionDisplay({ formatted: '$0.00', model: modelSelect.value || 'LinearRegression' });
