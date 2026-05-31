// Minimal-but-realistic ExtractPayload fixtures used by render tests.

export const fallbackPayload = {
  hostname: 'example.com',
  totalNodes: 42,
  truncated: false,
  groups: [
    {
      family: 'Arial',
      source: { type: 'system', format: null },
      isFallback: true,
      requestedFamily: 'Söhne',
      isVariable: false,
      axes: null,
      rows: [
        {
          key: 'Arial|16px|400|24px|normal|none|#222222',
          role: 'Body',
          count: 12,
          nodeIds: [1, 2, 3],
          detail: {
            requested: ['Söhne', 'Arial', 'sans-serif'],
            rendered: 'Arial',
            isFallback: true,
            source: { type: 'system', format: null, url: null, os: 'macos' },
            isVariable: false,
            axes: null,
            metrics: {
              size: '16px', weight: 400, lineHeight: '24px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
            },
            confidence: 'high',
          },
        },
      ],
    },
    {
      family: 'Inter',
      source: { type: 'google', format: 'woff2' },
      isFallback: false,
      isVariable: false,
      axes: null,
      rows: [
        {
          key: 'Inter|16px|400|24px|normal|none|#0f0f10',
          role: 'Body',
          count: 27,
          nodeIds: [7, 8, 9],
          detail: {
            requested: ['Inter', 'sans-serif'],
            rendered: 'Inter',
            isFallback: false,
            source: { type: 'google', format: 'woff2', url: 'https://fonts.gstatic.com/x.woff2', os: null },
            isVariable: false,
            axes: null,
            metrics: {
              size: '16px', weight: 400, lineHeight: '24px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' },
            },
            confidence: 'high',
          },
        },
        {
          key: 'Inter|32px|700|40px|normal|none|#0f0f10',
          role: 'Headline',
          count: 3,
          nodeIds: [4, 5, 6],
          detail: {
            requested: ['Inter', 'sans-serif'],
            rendered: 'Inter',
            isFallback: false,
            source: { type: 'google', format: 'woff2', url: 'https://fonts.gstatic.com/x.woff2', os: null },
            isVariable: false,
            axes: null,
            metrics: {
              size: '32px', weight: 700, lineHeight: '40px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' },
            },
            confidence: 'high',
          },
        },
      ],
    },
  ],
};

export const cleanPayload = {
  hostname: 'clean.example',
  totalNodes: 5,
  truncated: false,
  groups: [
    {
      family: 'Inter',
      source: { type: 'self-hosted', format: 'woff2' },
      isFallback: false,
      isVariable: false,
      axes: null,
      rows: [
        {
          key: 'Inter|16px|400|24px|normal|none|#0f0f10',
          role: 'Body',
          count: 5,
          nodeIds: [1, 2, 3, 4, 5],
          detail: {
            requested: ['Inter'],
            rendered: 'Inter',
            isFallback: false,
            source: { type: 'self-hosted', format: 'woff2', url: '/x.woff2', os: null },
            isVariable: false,
            axes: null,
            metrics: {
              size: '16px', weight: 400, lineHeight: '24px',
              letterSpacing: 'normal', transform: 'none',
              color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' },
            },
            confidence: 'high',
          },
        },
      ],
    },
  ],
};
