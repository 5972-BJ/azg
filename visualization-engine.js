/**
 * 通用可视化渲染引擎
 * 支持电路/自控多种可视化模板
 * 使用Canvas/SVG原生渲染，无外部依赖
 */

class VisualizationEngine {
  constructor(container) {
    this.container = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.params = {};
    this.config = null;
    this.onParamsChange = null;
    // 修复1：容器本身是 <canvas> 元素时（demo.html 的用法），直接拿它的 2d 上下文，
    // 否则 ctx 为 null，所有绘制函数都会崩溃
    if (this.container && this.container.tagName === 'CANVAS') {
      this.canvas = this.container;
      this.ctx = this.canvas.getContext('2d');
    }
    // 修复2：每个实例分配唯一 uid，避免同页多个可视化实例的滑块 id 冲突
    VisualizationEngine._uid = (VisualizationEngine._uid || 0) + 1;
    this.uid = VisualizationEngine._uid;
  }

  // 初始化Canvas
  initCanvas(width = 600, height = 400) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  // 创建参数控制面板
  createControlPanel(config) {
    this.config = config;
    const panel = document.createElement('div');
    panel.className = 'viz-control-panel';
    panel.style.cssText = `
      background: var(--card-bg, #fff);
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 12px;
      padding: 16px;
      margin-top: 16px;
    `;

    const title = document.createElement('div');
    title.className = 'viz-panel-title';
    title.style.cssText = 'font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text, #333);';
    title.textContent = '️ 参数调节';
    panel.appendChild(title);

    // 创建参数滑块
    for (const [key, param] of Object.entries(config.params)) {
      const row = document.createElement('div');
      row.className = 'param-row';
      row.style.cssText = 'margin-bottom: 10px;';

      const valueId = `param-${this.uid}-${key}-value`;
      const label = document.createElement('label');
      label.style.cssText = 'display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; color: var(--text, #333);';
      label.innerHTML = `
        <span>${param.label}</span>
        <span class="param-value" id="${valueId}">
          ${param.default}${param.unit ? ' ' + param.unit : ''}
        </span>
      `;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = param.range[0];
      input.max = param.range[1];
      input.step = param.step || (param.range[1] - param.range[0]) / 100;
      input.value = param.default;
      input.style.cssText = 'width: 100%; accent-color: var(--accent, #4a90e2);';

      input.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.params[key] = val;
        document.getElementById(valueId).textContent =
          `${val.toFixed(param.step < 1 ? (param.step < 0.01 ? 6 : 2) : 0)}${param.unit ? ' ' + param.unit : ''}`;
        if (this.onParamsChange) this.onParamsChange();
      });

      this.params[key] = param.default;
      row.appendChild(label);
      row.appendChild(input);
      panel.appendChild(row);
    }

    // 添加公式显示
    const formula = document.createElement('div');
    formula.className = 'viz-formula';
    formula.style.cssText = 'margin-top: 12px; padding: 8px 12px; background: var(--bubble-ai, #f5f5f5); border-radius: 8px; font-size: 13px; font-family: monospace; color: var(--text, #333);';
    formula.textContent = `📐 ${config.formula}`;
    panel.appendChild(formula);

    this.container.appendChild(panel);
    return panel;
  }

  // 清除画布
  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // 绘制坐标轴
  drawAxes(xLabel, yLabel, xRange, yRange) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const padding = 50;

    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#666';

    // X轴
    ctx.beginPath();
    ctx.moveTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();

    // Y轴
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.stroke();

    // 标签
    ctx.fillText(xLabel, w - padding + 10, h - padding + 5);
    ctx.fillText(yLabel, padding - 30, padding - 10);

    // 刻度
    const xSteps = 5;
    const ySteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const x = padding + (w - 2 * padding) * i / xSteps;
      const val = xRange[0] + (xRange[1] - xRange[0]) * i / xSteps;
      ctx.fillText(val.toFixed(1), x - 10, h - padding + 20);
    }
    for (let i = 0; i <= ySteps; i++) {
      const y = h - padding - (h - 2 * padding) * i / ySteps;
      const val = yRange[0] + (yRange[1] - yRange[0]) * i / ySteps;
      ctx.fillText(val.toFixed(1), padding - 35, y + 5);
    }
  }

  // 绘制曲线
  drawCurve(points, color = '#4a90e2', lineWidth = 2) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const padding = 50;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    // 修复3：Y 轴映射须考虑 yMin（RLC/正弦存在负值），否则负半轴曲线会画出绘图区
    const yMin = this.yMin || 0;
    points.forEach((p, i) => {
      const x = padding + (p.x / this.xMax) * (w - 2 * padding);
      const y = h - padding - ((p.y - yMin) / ((this.yMax || 1) - yMin)) * (h - 2 * padding);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  // 渲染RC暂态响应
  renderRCTransient(type = 'charge') {
    this.clear();
    const V0 = this.params.V0 || 5;
    const R = this.params.R || 1000;
    const C = this.params.C || 1e-6;
    const tau = R * C;

    const points = [];
    const tMax = 5 * tau;
    const steps = 200;

    for (let i = 0; i <= steps; i++) {
      const t = (tMax / steps) * i;
      let Vc;
      if (type === 'charge') {
        Vc = V0 * (1 - Math.exp(-t / tau));
      } else {
        Vc = V0 * Math.exp(-t / tau);
      }
      points.push({ x: t, y: Vc });
    }

    this.xMax = tMax;
    this.yMax = V0 * 1.2;

    this.drawAxes('时间 t (s)', '电压 Vc (V)', [0, tMax], [0, V0 * 1.2]);
    this.drawCurve(points, '#4a90e2', 2);

    // 标注时间常数τ
    const ctx = this.ctx;
    const padding = 50;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const tauX = padding + (tau / tMax) * (w - 2 * padding);
    // 修复4：τ 标注点 —— 充电在 0.632·V0，放电应在 0.368·V0
    const tauV = type === 'charge' ? V0 * 0.632 : V0 * 0.368;
    const tauY = h - padding - (tauV / this.yMax) * (h - 2 * padding);

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(tauX, tauY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`τ=${tau.toFixed(3)}s`, tauX + 10, tauY - 10);
  }

  // 渲染RL暂态响应
  renderRLTransient() {
    this.clear();
    const V0 = this.params.V0 || 5;
    const R = this.params.R || 100;
    const L = this.params.L || 0.1;
    const tau = L / R;
    const I0 = V0 / R;

    const points = [];
    const tMax = 5 * tau;
    const steps = 200;

    for (let i = 0; i <= steps; i++) {
      const t = (tMax / steps) * i;
      const iL = I0 * (1 - Math.exp(-t / tau));
      points.push({ x: t, y: iL });
    }

    this.xMax = tMax;
    this.yMax = I0 * 1.2;

    this.drawAxes('时间 t (s)', '电流 iL (A)', [0, tMax], [0, I0 * 1.2]);
    this.drawCurve(points, '#27ae60', 2);
  }

  // 渲染RLC暂态响应
  renderRLCTransient() {
    this.clear();
    const V0 = this.params.V0 || 5;
    const R = this.params.R || 10;
    const L = this.params.L || 0.1;
    const C = this.params.C || 1e-6;

    const alpha = R / (2 * L);
    const omega0 = 1 / Math.sqrt(L * C);
    const omegaD = Math.sqrt(Math.abs(omega0 * omega0 - alpha * alpha));

    const points = [];
    const tMax = 5 / Math.min(alpha, omega0);
    const steps = 500;

    for (let i = 0; i <= steps; i++) {
      const t = (tMax / steps) * i;
      let Vc;

      if (alpha > omega0) {
        // 过阻尼
        const s1 = -alpha + Math.sqrt(alpha * alpha - omega0 * omega0);
        const s2 = -alpha - Math.sqrt(alpha * alpha - omega0 * omega0);
        const A1 = V0 * s2 / (s2 - s1);
        const A2 = -V0 * s1 / (s2 - s1);
        Vc = A1 * Math.exp(s1 * t) + A2 * Math.exp(s2 * t);
      } else if (alpha < omega0) {
        // 欠阻尼
        Vc = V0 * Math.exp(-alpha * t) * (Math.cos(omegaD * t) + (alpha / omegaD) * Math.sin(omegaD * t));
      } else {
        // 临界阻尼
        Vc = V0 * (1 + alpha * t) * Math.exp(-alpha * t);
      }
      points.push({ x: t, y: Vc });
    }

    this.xMax = tMax;
    this.yMax = V0 * 1.5;
    this.yMin = -V0 * 0.5;

    this.drawAxes('时间 t (s)', '电压 Vc (V)', [0, tMax], [-V0 * 0.5, V0 * 1.5]);
    this.drawCurve(points, '#8e44ad', 2);
  }

  // 渲染正弦波形
  renderSinusoidal() {
    this.clear();
    const Vm = this.params.Vm || 5;
    const f = this.params.f || 50;
    const phi = (this.params.phi || 0) * Math.PI / 180;
    const omega = 2 * Math.PI * f;

    const points = [];
    const T = 1 / f;
    const tMax = 3 * T;
    const steps = 300;

    for (let i = 0; i <= steps; i++) {
      const t = (tMax / steps) * i;
      const v = Vm * Math.sin(omega * t + phi);
      points.push({ x: t, y: v });
    }

    this.xMax = tMax;
    this.yMax = Vm * 1.3;
    this.yMin = -Vm * 1.3;

    this.drawAxes('时间 t (s)', '电压 v (V)', [0, tMax], [-Vm * 1.3, Vm * 1.3]);
    this.drawCurve(points, '#e67e22', 2);
  }

  // 渲染阶跃响应
  renderStepResponse() {
    this.clear();
    const K = this.params.K || 1;
    const wn = this.params.wn || 5;
    const zeta = this.params.zeta || 0.7;

    const points = [];
    const tMax = 10 / (zeta * wn);
    const steps = 300;

    for (let i = 0; i <= steps; i++) {
      const t = (tMax / steps) * i;
      let c;

      if (zeta < 1) {
        // 欠阻尼
        const wd = wn * Math.sqrt(1 - zeta * zeta);
        const phi = Math.atan(Math.sqrt(1 - zeta * zeta) / zeta);
        c = K * (1 - Math.exp(-zeta * wn * t) * Math.sin(wd * t + phi) / Math.sin(phi));
      } else if (zeta === 1) {
        // 临界阻尼
        c = K * (1 - (1 + wn * t) * Math.exp(-wn * t));
      } else {
        // 过阻尼
        const s1 = -wn * (zeta - Math.sqrt(zeta * zeta - 1));
        const s2 = -wn * (zeta + Math.sqrt(zeta * zeta - 1));
        c = K * (1 + (s1 * Math.exp(s2 * t) - s2 * Math.exp(s1 * t)) / (s2 - s1));
      }
      points.push({ x: t, y: c });
    }

    this.xMax = tMax;
    this.yMax = K * 1.5;

    this.drawAxes('时间 t (s)', '输出 c(t)', [0, tMax], [0, K * 1.5]);
    this.drawCurve(points, '#16a085', 2);

    // 标注性能指标
    if (zeta < 1) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      const tp = Math.PI / wd;
      const Mp = K * (1 + Math.exp(-zeta * wn * tp));
      const ctx = this.ctx;
      ctx.fillStyle = '#e74c3c';
      ctx.fillText(`超调量 Mp=${((Mp/K - 1) * 100).toFixed(1)}%`, 200, 30);
    }
  }

  // 渲染PID响应
  renderPIDResponse() {
    this.clear();
    const Kp = this.params.Kp || 1;
    const Ki = this.params.Ki || 0.5;
    const Kd = this.params.Kd || 0.1;
    const wn = this.params.wn || 5;

    // 简化的PID响应模拟
    const points = [];
    const tMax = 10;
    const steps = 300;
    let y = 0, yPrev = 0, integral = 0;

    for (let i = 0; i <= steps; i++) {
      const t = (tMax / steps) * i;
      const r = 1; // 阶跃输入
      const e = r - y;
      integral += e * (tMax / steps);
      const derivative = (y - yPrev) / (tMax / steps);
      const u = Kp * e + Ki * integral + Kd * derivative;
      
      // 简化的二阶系统响应
      const a = wn * wn;
      const b = 2 * 0.7 * wn;
      const yNew = y + (tMax / steps) * (a * u - b * (y - yPrev) / (tMax / steps));
      
      points.push({ x: t, y: yNew });
      yPrev = y;
      y = yNew;
    }

    this.xMax = tMax;
    this.yMax = 1.5;

    this.drawAxes('时间 t (s)', '输出 y(t)', [0, tMax], [0, 1.5]);
    this.drawCurve(points, '#c0392b', 2);
  }

  // 已实现渲染函数的模板清单
  static get RENDERABLE_TEMPLATES() {
    return ['rc_transient', 'rl_transient', 'rlc_transient', 'sinusoidal_wave', 'step_response', 'pid_response'];
  }

  // 该模板是否有对应的渲染实现（页面集成时用来过滤，避免出现空白画布）
  static canRender(templateType) {
    return VisualizationEngine.RENDERABLE_TEMPLATES.includes(templateType);
  }

  // 根据模板类型自动选择渲染方法
  renderByTemplate(templateType) {
    const renderMap = {
      'rc_transient': () => this.renderRCTransient(this.config?.mode || 'charge'),
      'rl_transient': () => this.renderRLTransient(),
      'rlc_transient': () => this.renderRLCTransient(),
      'sinusoidal_wave': () => this.renderSinusoidal(),
      'step_response': () => this.renderStepResponse(),
      'pid_response': () => this.renderPIDResponse()
    };

    const renderFn = renderMap[templateType];
    if (renderFn) {
      renderFn();
    } else {
      console.warn('未找到模板:', templateType);
    }
  }

  // 启动动画
  animate(renderFn, interval = 50) {
    this.stop();
    renderFn();
    this.animationId = setInterval(renderFn, interval);
  }

  // 停止动画
  stop() {
    if (this.animationId) {
      clearInterval(this.animationId);
      this.animationId = null;
    }
  }

  // 销毁
  destroy() {
    this.stop();
    if (this.canvas) {
      this.canvas.remove();
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualizationEngine;
}
if (typeof window !== 'undefined') {
  window.VisualizationEngine = VisualizationEngine;
}
