// Mock-up data until the real queries are wired in.

export const MOCK_DX = [
  { code: 'I10', name: 'Essential (primary) hypertension', type: 'Principal' },
  { code: 'E11.9', name: 'Type 2 diabetes mellitus without complications', type: 'Comorbidity' },
]

export const MOCK_LAB = [
  { name: 'FBS', result: '142', unit: 'mg/dL', range: '70-100', flag: 'H' },
  { name: 'HbA1c', result: '7.8', unit: '%', range: '4.0-6.0', flag: 'H' },
  { name: 'Cholesterol', result: '186', unit: 'mg/dL', range: '<200', flag: '' },
  { name: 'LDL', result: '118', unit: 'mg/dL', range: '<100', flag: 'H' },
  { name: 'Creatinine', result: '0.9', unit: 'mg/dL', range: '0.5-1.1', flag: '' },
  { name: 'eGFR', result: '78', unit: 'mL/min/1.73m²', range: '>90', flag: 'L' },
]

export const MOCK_RX = [
  { name: 'Amlodipine 5 mg tab', usage: '1 เม็ด วันละ 1 ครั้ง หลังอาหารเช้า', qty: 30, unit: 'เม็ด' },
  { name: 'Metformin 500 mg tab', usage: '1 เม็ด วันละ 2 ครั้ง หลังอาหารเช้า-เย็น', qty: 60, unit: 'เม็ด' },
  { name: 'Simvastatin 20 mg tab', usage: '1 เม็ด ก่อนนอน', qty: 30, unit: 'เม็ด' },
  { name: 'Omeprazole 20 mg cap', usage: '1 แคปซูล ก่อนอาหารเช้า', qty: 30, unit: 'แคปซูล' },
  { name: 'Paracetamol 500 mg tab', usage: '1 เม็ด เมื่อปวด/ไข้ ทุก 4-6 ชม.', qty: 20, unit: 'เม็ด' },
]
