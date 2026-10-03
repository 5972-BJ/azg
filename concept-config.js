/**
 * 电路/自控知识点可视化配置表
 * 基于邱关源《电路》（第5版）+ 自动控制原理
 * 
 * 每个知识点配置：
 * - id: 唯一标识
 * - name: 概念名称
 * - chapter: 所属章节
 * - type: 可视化类型
 * - template: 渲染模板
 * - params: 可调节参数
 * - formula: 核心公式
 * - examples: 预设例题参数
 */

const CONCEPT_VISUALIZATION_CONFIG = {
  // ==================== 电路部分（邱关源《电路》） ====================
  
  circuit: {
    // 第1章 电路模型和定律
    ohm_law: {
      id: 'ohm_law',
      name: '欧姆定律',
      chapter: 1,
      type: 'iv_characteristic',
      template: 'iv_curve',
      params: {
        R: { range: [10, 10000], unit: 'Ω', default: 1000, label: '电阻R' }
      },
      formula: 'V = IR',
      description: '线性电阻的电压-电流特性曲线'
    },

    kirchhoff: {
      id: 'kirchhoff',
      name: '基尔霍夫定律',
      chapter: 1,
      type: 'circuit_topology',
      template: 'circuit_diagram',
      params: {
        V1: { range: [0, 20], unit: 'V', default: 10, label: '电压源V1' },
        V2: { range: [0, 20], unit: 'V', default: 5, label: '电压源V2' },
        R1: { range: [10, 1000], unit: 'Ω', default: 100, label: '电阻R1' },
        R2: { range: [10, 1000], unit: 'Ω', default: 200, label: '电阻R2' }
      },
      formula: 'KCL: ΣI = 0, KVL: ΣV = 0',
      description: '电路拓扑结构与电流分布'
    },

    // 第3章 电阻电路分析
    node_voltage: {
      id: 'node_voltage',
      name: '节点电压法',
      chapter: 3,
      type: 'circuit_analysis',
      template: 'node_analysis',
      params: {
        V1: { range: [0, 20], unit: 'V', default: 10, label: '电压源V1' },
        I1: { range: [0, 10], unit: 'A', default: 2, label: '电流源I1' },
        R1: { range: [10, 1000], unit: 'Ω', default: 100, label: '电阻R1' },
        R2: { range: [10, 1000], unit: 'Ω', default: 200, label: '电阻R2' },
        R3: { range: [10, 1000], unit: 'Ω', default: 300, label: '电阻R3' }
      },
      formula: 'G·V = I',
      description: '节点电压方程求解'
    },

    // 第4章 电路定理
    thevenin: {
      id: 'thevenin',
      name: '戴维南定理',
      chapter: 4,
      type: 'equivalent_circuit',
      template: 'thevenin_equivalent',
      params: {
        V1: { range: [0, 20], unit: 'V', default: 10, label: '电压源V1' },
        R1: { range: [10, 1000], unit: 'Ω', default: 100, label: '电阻R1' },
        R2: { range: [10, 1000], unit: 'Ω', default: 200, label: '电阻R2' },
        RL: { range: [10, 1000], unit: 'Ω', default: 300, label: '负载RL' }
      },
      formula: 'Voc = V_th, R_eq = R_th',
      description: '原电路与戴维南等效电路对比'
    },

    // 第6章 储能元件
    capacitor: {
      id: 'capacitor',
      name: '电容元件特性',
      chapter: 6,
      type: 'component_characteristic',
      template: 'capacitor_iv',
      params: {
        C: { range: [1e-6, 1e-3], unit: 'F', default: 1e-6, label: '电容C', step: 1e-6 },
        V0: { range: [0, 10], unit: 'V', default: 5, label: '初始电压V0' }
      },
      formula: 'i = C·dv/dt, W = ½CV²',
      description: '电容电压电流关系与储能'
    },

    inductor: {
      id: 'inductor',
      name: '电感元件特性',
      chapter: 6,
      type: 'component_characteristic',
      template: 'inductor_iv',
      params: {
        L: { range: [1e-3, 1], unit: 'H', default: 0.1, label: '电感L', step: 0.01 },
        I0: { range: [0, 10], unit: 'A', default: 2, label: '初始电流I0' }
      },
      formula: 'v = L·di/dt, W = ½LI²',
      description: '电感电压电流关系与储能'
    },

    // 第7章 一阶电路（重点！）
    rc_charge: {
      id: 'rc_charge',
      name: 'RC电路充电过程',
      chapter: 7,
      type: 'transient_response',
      template: 'rc_transient',
      mode: 'charge',
      params: {
        V0: { range: [0, 10], unit: 'V', default: 5, label: '电源电压V0' },
        R: { range: [100, 10000], unit: 'Ω', default: 1000, label: '电阻R' },
        C: { range: [1e-6, 1e-3], unit: 'F', default: 1e-6, label: '电容C', step: 1e-6 }
      },
      formula: 'Vc(t) = V0(1-e^{-t/τ}), τ=RC',
      description: 'RC串联电路充电电压曲线'
    },

    rc_discharge: {
      id: 'rc_discharge',
      name: 'RC电路放电过程',
      chapter: 7,
      type: 'transient_response',
      template: 'rc_transient',
      mode: 'discharge',
      params: {
        V0: { range: [0, 10], unit: 'V', default: 5, label: '初始电压V0' },
        R: { range: [100, 10000], unit: 'Ω', default: 1000, label: '电阻R' },
        C: { range: [1e-6, 1e-3], unit: 'F', default: 1e-6, label: '电容C', step: 1e-6 }
      },
      formula: 'Vc(t) = V0·e^{-t/τ}, τ=RC',
      description: 'RC电路放电电压曲线'
    },

    rl_charge: {
      id: 'rl_charge',
      name: 'RL电路充电过程',
      chapter: 7,
      type: 'transient_response',
      template: 'rl_transient',
      params: {
        V0: { range: [0, 10], unit: 'V', default: 5, label: '电源电压V0' },
        R: { range: [10, 1000], unit: 'Ω', default: 100, label: '电阻R' },
        L: { range: [1e-3, 1], unit: 'H', default: 0.1, label: '电感L', step: 0.01 }
      },
      formula: 'iL(t) = I0(1-e^{-t/τ}), τ=L/R',
      description: 'RL串联电路充电电流曲线'
    },

    // 第8章 二阶电路
    rlc_response: {
      id: 'rlc_response',
      name: 'RLC串联电路响应',
      chapter: 8,
      type: 'transient_response',
      template: 'rlc_transient',
      params: {
        V0: { range: [0, 10], unit: 'V', default: 5, label: '初始电压V0' },
        R: { range: [1, 1000], unit: 'Ω', default: 10, label: '电阻R' },
        L: { range: [1e-3, 1], unit: 'H', default: 0.1, label: '电感L', step: 0.01 },
        C: { range: [1e-6, 1e-3], unit: 'F', default: 1e-6, label: '电容C', step: 1e-6 }
      },
      formula: 'LC·d²v/dt² + RC·dv/dt + v = 0',
      description: 'RLC二阶电路零输入响应（过阻尼/欠阻尼/临界）',
      modes: ['overdamped', 'underdamped', 'critical']
    },

    // 第9章 正弦稳态分析
    sinusoidal_steady: {
      id: 'sinusoidal_steady',
      name: '正弦稳态响应',
      chapter: 9,
      type: 'frequency_response',
      template: 'sinusoidal_wave',
      params: {
        Vm: { range: [0, 10], unit: 'V', default: 5, label: '幅值Vm' },
        f: { range: [1, 1000], unit: 'Hz', default: 50, label: '频率f' },
        phi: { range: [-180, 180], unit: '°', default: 0, label: '初相φ' },
        R: { range: [10, 1000], unit: 'Ω', default: 100, label: '电阻R' }
      },
      formula: 'v(t) = Vm·sin(ωt+φ), ω=2πf',
      description: '正弦电压电流波形与相位关系'
    },

    phasor: {
      id: 'phasor',
      name: '相量图',
      chapter: 9,
      type: 'frequency_response',
      template: 'phasor_diagram',
      params: {
        Vm: { range: [0, 10], unit: 'V', default: 5, label: '电压幅值Vm' },
        Im: { range: [0, 10], unit: 'A', default: 2, label: '电流幅值Im' },
        phi: { range: [-90, 90], unit: '°', default: 30, label: '相位差φ' }
      },
      formula: 'V̇ = Vmφv, İ = Im∠φi',
      description: '电压电流相量表示'
    },

    impedance: {
      id: 'impedance',
      name: '阻抗与导纳',
      chapter: 9,
      type: 'frequency_response',
      template: 'impedance_triangle',
      params: {
        R: { range: [10, 1000], unit: 'Ω', default: 100, label: '电阻R' },
        X: { range: [-500, 500], unit: 'Ω', default: 200, label: '电抗X' },
        f: { range: [1, 1000], unit: 'Hz', default: 50, label: '频率f' }
      },
      formula: 'Z = R + jX, |Z| = √(R²+X²)',
      description: '阻抗三角形与频率特性'
    },

    // 第12章 拉普拉斯变换
    laplace_transform: {
      id: 'laplace_transform',
      name: '拉普拉斯变换',
      chapter: 12,
      type: 'transform_analysis',
      template: 'laplace_domain',
      params: {
        sigma: { range: [-5, 5], unit: '', default: 0, label: '实部σ', step: 0.1 },
        omega: { range: [-10, 10], unit: 'rad/s', default: 5, label: '虚部ω', step: 0.5 }
      },
      formula: 'F(s) = ∫f(t)e^{-st}dt, s=σ+jω',
      description: 's域分析与极零点'
    }
  },

  // ==================== 自动控制原理部分 ====================
  
  control: {
    // 基本概念
    transfer_function: {
      id: 'transfer_function',
      name: '传递函数',
      chapter: 2,
      type: 'system_analysis',
      template: 'transfer_function',
      params: {
        K: { range: [0.1, 10], unit: '', default: 1, label: '增益K', step: 0.1 },
        T1: { range: [0.1, 10], unit: 's', default: 1, label: '时间常数T1', step: 0.1 },
        T2: { range: [0.1, 10], unit: 's', default: 0.5, label: '时间常数T2', step: 0.1 }
      },
      formula: 'G(s) = K/((T1s+1)(T2s+1))',
      description: '典型二阶系统传递函数'
    },

    // 时域分析
    step_response: {
      id: 'step_response',
      name: '阶跃响应',
      chapter: 3,
      type: 'time_response',
      template: 'step_response',
      params: {
        K: { range: [0.1, 10], unit: '', default: 1, label: '增益K', step: 0.1 },
        wn: { range: [0.1, 20], unit: 'rad/s', default: 5, label: '自然频率ωn', step: 0.5 },
        zeta: { range: [0, 2], unit: '', default: 0.7, label: '阻尼比ζ', step: 0.05 }
      },
      formula: 'C(s) = ωn²/(s²+2ζωns+ωn²)',
      description: '二阶系统阶跃响应曲线',
      metrics: ['rise_time', 'overshoot', 'settling_time', 'steady_error']
    },

    // 根轨迹
    root_locus: {
      id: 'root_locus',
      name: '根轨迹',
      chapter: 4,
      type: 'stability_analysis',
      template: 'root_locus',
      params: {
        K: { range: [0, 100], unit: '', default: 1, label: '增益K', step: 1 },
        z: { range: [-10, 10], unit: '', default: -2, label: '零点z', step: 0.5 },
        p1: { range: [-10, 0], unit: '', default: 0, label: '极点p1', step: 0.5 },
        p2: { range: [-10, 0], unit: '', default: -5, label: '极点p2', step: 0.5 }
      },
      formula: '1 + K·G(s) = 0',
      description: '根轨迹与系统稳定性'
    },

    // 频域分析
    bode_plot: {
      id: 'bode_plot',
      name: '伯德图',
      chapter: 5,
      type: 'frequency_analysis',
      template: 'bode_plot',
      params: {
        K: { range: [0.1, 10], unit: '', default: 1, label: '增益K', step: 0.1 },
        T1: { range: [0.1, 10], unit: 's', default: 1, label: '时间常数T1', step: 0.1 },
        T2: { range: [0.1, 10], unit: 's', default: 0.5, label: '时间常数T2', step: 0.1 }
      },
      formula: 'G(jω) = K/((jωT1+1)(jωT2+1))',
      description: '系统频率响应伯德图'
    },

    nyquist: {
      id: 'nyquist',
      name: '奈奎斯特图',
      chapter: 5,
      type: 'frequency_analysis',
      template: 'nyquist_plot',
      params: {
        K: { range: [0.1, 10], unit: '', default: 1, label: '增益K', step: 0.1 },
        T1: { range: [0.1, 10], unit: 's', default: 1, label: '时间常数T1', step: 0.1 }
      },
      formula: 'G(jω) = K/(jωT1+1)',
      description: '奈奎斯特稳定性判据'
    },

    // PID控制
    pid_control: {
      id: 'pid_control',
      name: 'PID控制器',
      chapter: 6,
      type: 'controller_design',
      template: 'pid_response',
      params: {
        Kp: { range: [0, 20], unit: '', default: 1, label: '比例Kp', step: 0.1 },
        Ki: { range: [0, 10], unit: '', default: 0.5, label: '积分Ki', step: 0.1 },
        Kd: { range: [0, 5], unit: '', default: 0.1, label: '微分Kd', step: 0.05 },
        wn: { range: [1, 20], unit: 'rad/s', default: 5, label: '自然频率ωn', step: 0.5 }
      },
      formula: 'u(t) = Kp·e + Ki·∫e·dt + Kd·de/dt',
      description: 'PID参数调节与系统响应'
    }
  }
};

// 知识点搜索关键词映射（用户输入概念时模糊匹配）
const CONCEPT_KEYWORDS = {
  // 电路关键词
  '欧姆定律': ['ohm_law'],
  '电阻': ['ohm_law'],
  '基尔霍夫': ['kirchhoff'],
  'KCL': ['kirchhoff'],
  'KVL': ['kirchhoff'],
  '节点电压': ['node_voltage'],
  '网孔电流': ['node_voltage'],
  '戴维南': ['thevenin'],
  '诺顿': ['thevenin'],
  '等效电路': ['thevenin'],
  '电容': ['capacitor'],
  '电感': ['inductor'],
  '储能': ['capacitor', 'inductor'],
  'RC电路': ['rc_charge', 'rc_discharge'],
  'RL电路': ['rl_charge'],
  '充电': ['rc_charge', 'rl_charge'],
  '放电': ['rc_discharge'],
  '一阶电路': ['rc_charge', 'rc_discharge', 'rl_charge'],
  'RLC': ['rlc_response'],
  '二阶电路': ['rlc_response'],
  '正弦': ['sinusoidal_steady'],
  '交流': ['sinusoidal_steady'],
  '相量': ['phasor'],
  '阻抗': ['impedance'],
  '拉普拉斯': ['laplace_transform'],
  's域': ['laplace_transform'],

  // 自控关键词
  '传递函数': ['transfer_function'],
  '阶跃响应': ['step_response'],
  '阻尼': ['step_response'],
  '超调': ['step_response'],
  '根轨迹': ['root_locus'],
  '伯德图': ['bode_plot'],
  'bode': ['bode_plot'],
  '奈奎斯特': ['nyquist'],
  'nyquist': ['nyquist'],
  'PID': ['pid_control'],
  '比例积分微分': ['pid_control']
};

// 根据概念名称匹配可视化配置
function matchConcept(concept) {
  if (!concept) return null;
  
  const lower = concept.toLowerCase();
  const matched = [];
  
  // 遍历关键词映射
  for (const [keyword, ids] of Object.entries(CONCEPT_KEYWORDS)) {
    if (lower.includes(keyword.toLowerCase())) {
      ids.forEach(id => {
        // 在circuit和control中查找
        const config = CONCEPT_VISUALIZATION_CONFIG.circuit[id] || 
                      CONCEPT_VISUALIZATION_CONFIG.control[id];
        if (config) matched.push(config);
      });
    }
  }
  
  return matched.length > 0 ? matched : null;
}

// 导出（兼容浏览器和Node）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONCEPT_VISUALIZATION_CONFIG, CONCEPT_KEYWORDS, matchConcept };
}
if (typeof window !== 'undefined') {
  window.CONCEPT_VISUALIZATION_CONFIG = CONCEPT_VISUALIZATION_CONFIG;
  window.CONCEPT_KEYWORDS = CONCEPT_KEYWORDS;
  window.matchConcept = matchConcept;
}
