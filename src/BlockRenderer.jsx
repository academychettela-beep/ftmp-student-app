import React from 'react';

const T = { navy: '#16213E', gold: '#C9A227', goldInk: '#7A5A16', ink: '#2B2B28', parch: '#F5F0E6', line: '#E0D6BC', red: '#A65D57' };
const serif = '"Cormorant Garamond", serif';
const sans = 'Montserrat, sans-serif';

// Source text is stored in capitals as printed; show it in sentence case.
const sc = (s) => (/[a-z]/.test(s) ? s : s.charAt(0) + s.slice(1).toLowerCase());

function Inline({ s }) {
  return String(s).split(/(\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*)/g).map((p, i) => {
    if (p.startsWith('***')) return <strong key={i}><em>{p.slice(3, -3)}</em></strong>;
    if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

const List = ({ items, mark = '▪', color = T.gold }) => (
  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
    {items.map((x, i) => (
      <li key={i} style={{ display: 'flex', gap: 10, lineHeight: 1.65, marginBottom: 6 }}>
        <span style={{ color, flexShrink: 0 }}>{mark}</span>
        <span><Inline s={x} /></span>
      </li>
    ))}
  </ul>
);

const Title = ({ children, color }) => (
  <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color, marginBottom: 6 }}>{sc(children)}</div>
);

const Card = ({ title, bg, border, accent, titleColor, color, children }) => (
  <div style={{ background: bg, border: `1px solid ${border}`, borderLeft: `4px solid ${accent}`, borderRadius: 4, padding: '14px 18px', margin: '16px 0', color: color || T.ink }}>
    {title && <Title color={titleColor || T.navy}>{title}</Title>}
    {children}
  </div>
);

const Pairs = ({ items }) => (
  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
    {items.map((x, i) => {
      const m = /^([A-Z][A-Z ]+):\s*(.*)$/.exec(x);
      return <li key={i} style={{ lineHeight: 1.6, marginBottom: 6 }}>{m ? <><strong style={{ color: T.goldInk }}>{sc(m[1])}:</strong> {m[2]}</> : x}</li>;
    })}
  </ul>
);

function Block({ b }) {
  switch (b.type) {
    case 'heading':
      return <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: T.navy, margin: '32px 0 12px', paddingBottom: 6, borderBottom: `1px solid ${T.gold}` }}>{sc(b.text)}</h2>;
    case 'text':
      return <p style={{ margin: '0 0 12px', lineHeight: 1.75 }}><Inline s={b.text} /></p>;
    case 'bullets':
      return <div>{b.title && <Title color={T.navy}>{b.title}</Title>}<List items={b.items} /></div>;
    case 'definition':
      return <Card bg="#FBF6E8" border={T.line} accent={T.gold}><Title color={T.navy}>{b.term}</Title><div style={{ lineHeight: 1.7 }}><Inline s={b.text} /></div></Card>;
    case 'chips':
      return (
        <div style={{ margin: '8px 0 16px' }}>
          {b.title && <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: T.goldInk, marginBottom: 6 }}>{sc(b.title)}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {b.items.map((c, i) => <span key={i} style={{ fontFamily: sans, fontSize: 12.5, background: 'white', border: `1px solid ${T.gold}`, color: T.navy, padding: '5px 12px', borderRadius: 999 }}>{c}</span>)}
          </div>
        </div>
      );
    case 'emphasis': {
      if (/^CTF PILLAR/.test(b.text)) {
        const rest = b.text.replace(/^CTF PILLAR\s*·\s*/, '');
        return <div style={{ display: 'inline-block', fontFamily: sans, fontSize: 12, background: T.navy, color: T.gold, padding: '5px 12px', borderRadius: 4, margin: '4px 0 8px' }}>CTF pillar: {sc(rest)}</div>;
      }
      return <blockquote style={{ fontFamily: serif, fontSize: 24, lineHeight: 1.35, color: T.navy, borderLeft: `3px solid ${T.gold}`, margin: '20px 0', padding: '2px 0 2px 18px' }}><Inline s={b.text} /></blockquote>;
    }
    case 'example': {
      const flow = b.extra && b.extra.flow;
      return (
        <Card title={b.title} bg={T.navy} border={T.navy} accent={T.gold} titleColor={T.gold} color="#E8E4D8">
          {b.text.split('\n\n').map((p, i) => <p key={i} style={{ margin: '0 0 10px', lineHeight: 1.7 }}><Inline s={p} /></p>)}
          {flow && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {flow.map((f, i) => i % 2 === 0
                ? <span key={i} style={{ fontFamily: sans, fontSize: 12, border: `1px solid ${T.gold}`, color: T.gold, padding: '6px 10px', borderRadius: 4 }}>{sc(f)}</span>
                : <span key={i} style={{ fontFamily: sans, fontSize: 12, color: '#B9C0D4' }}>— {f} →</span>)}
            </div>
          )}
        </Card>
      );
    }
    case 'tips':
      return <Card title={b.title} bg="#FBF6E8" border={T.line} accent={T.gold}><List items={b.items} /></Card>;
    case 'mistakes':
      return <Card title={b.title} bg="#F7EBEA" border="#E7C9C6" accent={T.red} titleColor={T.red}><List items={b.items} mark="✕" color={T.red} /></Card>;
    case 'summary':
      return <Card title={b.title} bg="white" border={T.line} accent={T.navy}><List items={b.items} mark="✓" color={T.navy} /></Card>;
    case 'participants':
      return (
        <div style={{ margin: '12px 0 16px' }}>
          {b.title && <Title color={T.navy}>{b.title}</Title>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            {b.items.map((p, i) => (
              <div key={i} style={{ background: 'white', border: `1px solid ${T.line}`, borderRadius: 4, padding: '10px 14px' }}>
                <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: T.goldInk }}>{sc(p.name)}</div>
                <div style={{ fontSize: 14, lineHeight: 1.55 }}>{p.text}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'comparison':
      return (
        <div style={{ margin: '12px 0 16px' }}>
          {b.title && <Title color={T.navy}>{b.title}</Title>}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${b.columns.length}, 1fr)`, gap: 10 }}>
            {b.columns.map((c, i) => <div key={i} style={{ background: 'white', border: `1px solid ${T.line}`, borderTop: `3px solid ${T.gold}`, padding: '10px 14px' }}><Title color={T.navy}>{c.heading}</Title><Pairs items={c.items} /></div>)}
          </div>
        </div>
      );
    case 'process':
      return (
        <Card title={b.title} bg="white" border={T.line} accent={T.navy}>
          {b.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <span style={{ fontFamily: sans, fontSize: 12, background: T.navy, color: T.gold, width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ lineHeight: 1.6 }}><strong>{sc(String(s.label).replace(/^\d+\s+/, ''))}</strong>{s.text ? ` — ${s.text}` : ''}</span>
            </div>
          ))}
        </Card>
      );
    case 'formula':
      return <Card title={b.title} bg="white" border={T.line} accent={T.gold}><div style={{ fontFamily: serif, fontSize: 22, fontStyle: 'italic', color: T.navy }}>{b.expression}</div>{b.text && <div style={{ marginTop: 6 }}>{b.text}</div>}</Card>;
    case 'illustration':
      return <figure style={{ margin: '16px 0', padding: 16, border: `1px dashed ${T.gold}`, textAlign: 'center', color: T.goldInk }}>[Illustration: {b.caption || b.file}]</figure>;
    default:
      return <Card title={b.title} bg="white" border={T.line} accent={T.line}>{b.items ? <List items={b.items} /> : <Inline s={b.text || ''} />}</Card>;
  }
}

export function Blocks({ blocks, title }) {
  const first = blocks[0];
  const list = first && first.type === 'heading' && first.text.toUpperCase().includes(String(title).toUpperCase()) ? blocks.slice(1) : blocks;
  return <div>{list.map((b, i) => <Block key={i} b={b} />)}</div>;
}

export { sc };
