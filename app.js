const rpsInput = document.getElementById("rps");
const errInput = document.getElementById("err");
const sloInput = document.getElementById("slo");
const simulateBtn = document.getElementById("simulate");
const incidentBtn = document.getElementById("incident");

const rpsVal = document.getElementById("rpsVal");
const errVal = document.getElementById("errVal");
const sloVal = document.getElementById("sloVal");

const burn5Text = document.getElementById("burn5");
const burn60Text = document.getElementById("burn60");
const budgetText = document.getElementById("budget");
const pagesText = document.getElementById("pages");

const timeline = document.getElementById("timeline");
const burnChart = document.getElementById("burnChart");
const tctx = timeline.getContext("2d");
const bctx = burnChart.getContext("2d");

let data = [];
let burn5 = [];
let burn60 = [];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function movingAvg(values, win) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= win) sum -= values[i - win];
    out.push(sum / Math.min(i + 1, win));
  }
  return out;
}

function generate(incident = false) {
  const baseRps = Number(rpsInput.value);
  const baseErr = Number(errInput.value) / 100;
  const minutes = 24 * 60;
  data = [];

  const incidentStart = Math.floor(rand(380, 1080));
  const incidentLen = Math.floor(rand(40, 150));

  for (let m = 0; m < minutes; m += 1) {
    const diurnal = 0.82 + 0.35 * Math.sin((m / minutes) * Math.PI * 2);
    const rps = baseRps * diurnal * rand(0.92, 1.08);

    let err = baseErr * rand(0.78, 1.2);
    if (incident && m >= incidentStart && m < incidentStart + incidentLen) {
      const t = (m - incidentStart) / incidentLen;
      const spike = 1 + 6 * Math.sin(Math.PI * t);
      err *= spike;
    }

    data.push({ m, rps, err: Math.max(0, err) });
  }

  computeBurnRates();
  render();
  updateMetrics();
}

function computeBurnRates() {
  const slo = Number(sloInput.value) / 100;
  const budgetErr = Math.max(1e-6, 1 - slo);
  const errSeries = data.map((d) => d.err);

  burn5 = movingAvg(errSeries, 5).map((v) => v / budgetErr);
  burn60 = movingAvg(errSeries, 60).map((v) => v / budgetErr);
}

function updateMetrics() {
  if (!data.length) return;

  const last5 = burn5[burn5.length - 1];
  const last60 = burn60[burn60.length - 1];

  const badReq = data.reduce((acc, d) => acc + d.rps * d.err, 0);
  const totalReq = data.reduce((acc, d) => acc + d.rps, 0);
  const slo = Number(sloInput.value) / 100;
  const budgetFraction = Math.min(1, (badReq / Math.max(1, totalReq)) / Math.max(1e-6, 1 - slo));

  let pages = 0;
  for (let i = 1; i < burn5.length; i += 1) {
    if (burn5[i - 1] < 14 && burn5[i] >= 14 && burn60[i] >= 6) {
      pages += 1;
    }
  }

  burn5Text.textContent = `${last5.toFixed(2)}x`;
  burn60Text.textContent = `${last60.toFixed(2)}x`;
  budgetText.textContent = `${(budgetFraction * 100).toFixed(1)}%`;
  pagesText.textContent = String(pages);
}

function drawSeries(ctx, canvas, series, color, maxY) {
  const w = canvas.width;
  const h = canvas.height;
  const sx = (i) => 20 + (i / (series.length - 1)) * (w - 40);
  const sy = (v) => h - 20 - (v / maxY) * (h - 40);

  ctx.beginPath();
  series.forEach((v, i) => {
    const x = sx(i);
    const y = sy(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

function renderTimeline() {
  tctx.clearRect(0, 0, timeline.width, timeline.height);
  tctx.fillStyle = "#070c1a";
  tctx.fillRect(0, 0, timeline.width, timeline.height);
  if (!data.length) return;

  const series = data.map((d) => d.err * 100);
  const maxY = Math.max(5, ...series) * 1.2;

  tctx.strokeStyle = "rgba(160,196,255,0.24)";
  for (let i = 0; i <= 5; i += 1) {
    const y = 20 + (i / 5) * (timeline.height - 40);
    tctx.beginPath();
    tctx.moveTo(20, y);
    tctx.lineTo(timeline.width - 20, y);
    tctx.stroke();
  }

  drawSeries(tctx, timeline, series, "#8fbaff", maxY);
}

function renderBurn() {
  bctx.clearRect(0, 0, burnChart.width, burnChart.height);
  bctx.fillStyle = "#070c1a";
  bctx.fillRect(0, 0, burnChart.width, burnChart.height);
  if (!burn5.length) return;

  const maxY = Math.max(20, ...burn5, ...burn60) * 1.1;

  drawSeries(bctx, burnChart, burn5, "#ffbf91", maxY);
  drawSeries(bctx, burnChart, burn60, "#93f1c2", maxY);

  const y = burnChart.height - 20 - (14 / maxY) * (burnChart.height - 40);
  bctx.strokeStyle = "rgba(255,140,140,0.8)";
  bctx.setLineDash([8, 6]);
  bctx.beginPath();
  bctx.moveTo(20, y);
  bctx.lineTo(burnChart.width - 20, y);
  bctx.stroke();
  bctx.setLineDash([]);
}

function render() {
  renderTimeline();
  renderBurn();
}

function syncLabels() {
  rpsVal.textContent = rpsInput.value;
  errVal.textContent = Number(errInput.value).toFixed(2);
  sloVal.textContent = Number(sloInput.value).toFixed(2);
}

[rpsInput, errInput, sloInput].forEach((el) => {
  el.addEventListener("input", syncLabels);
});

simulateBtn.addEventListener("click", () => generate(false));
incidentBtn.addEventListener("click", () => generate(true));

syncLabels();
generate(false);
