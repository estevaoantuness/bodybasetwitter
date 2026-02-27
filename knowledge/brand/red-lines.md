# BodyBase — Linhas Vermelhas (Red Lines)

Regras absolutas. Nenhum tweet é publicado se violar qualquer item desta lista.

---

## 1. Verbos Proibidos

Nunca usar estes verbos ligados a um produto, exame ou protocolo da BodyBase:

| Proibido | Por quê | Alternativa aprovada |
|---|---|---|
| "trata" | Claim terapêutico (área médica regulada) | "está associado a melhora em..." |
| "cura" | Afirmação absoluta não sustentável | "estudos observam redução de..." |
| "previne" | Causalidade não comprovada em geral | "correlacionado com menor incidência de..." |
| "garante" | Nenhum dado garante resultado individual | "em populações estudadas, foi observado..." |
| "elimina" | Absoluto, não sustentável | "pode contribuir para redução de..." |
| "protege" | Claim de proteção = área regulada | "associado a menor risco de..." |
| "aumenta imunidade" | Expressão regulada pela ANVISA | "associado a função imune adequada" |
| "desintoxica" | Sem base fisiológica clara | [evitar o tema] |
| "rejuvenesce" | Cosmético/apelo emocional | "associado a marcadores de envelhecimento biológico mais baixos" |

---

## 2. Linguagem Aprovada

Substituições seguras para comunicar eficácia sem claim médico:

```
RUIM: "O magnésio cura insônia"
BOM:  "Deficiência de magnésio está associada a pior qualidade do sono (Sleep Medicine Reviews, 2021)"

RUIM: "Testosterona baixa causa depressão"
BOM:  "Estudos observacionais associam testosterona sérica < 300 ng/dL a maior prevalência de sintomas depressivos"

RUIM: "Vitamina D previne câncer"
BOM:  "Meta-análises sugerem correlação entre níveis adequados de vitamina D e menor mortalidade por algumas neoplasias — causalidade ainda debatida"

RUIM: "Monitore sua glicose e perca peso"
BOM:  "Variabilidade glicêmica elevada está associada a maior adiposidade visceral em estudos de coorte"
```

---

## 3. Regra de Estatística

**Nunca inventar ou arredondar um número.**

- Se o estudo diz 23%, escrever 23% (não "quase 25%")
- Se não há dado preciso, não usar número — usar qualitativo ("estudos indicam aumento significativo")
- Todo número deve ter fonte citável (autor + ano mínimo, idealmente DOI)
- Números de n amostral importam: "estudo com 40 participantes" ≠ "estudo com 50.000 participantes"

**Formato de citação em tweets:**
```
(Nature Medicine, 2023) — para journals
(Framingham Heart Study) — para estudos icônicos
(NHANES 2017-2020) — para datasets públicos
(meta-análise, Cochrane) — para revisões sistemáticas
```

---

## 4. Regra de Causalidade

**Correlação ≠ causalidade. Sempre separar explicitamente.**

| Situação | O que escrever |
|---|---|
| Estudo observacional | "associado a", "correlacionado com", "observou-se que" |
| RCT com intervenção | "causou", "resultou em", "produziu redução de" — mas só para o desfecho medido |
| Meta-análise de RCTs | "evidências sugerem efeito causal de X em Y" — com moderação |
| Estudo animal / in vitro | NÃO usar como claim — no máximo como "mecanismo biológico proposto" |

**Exemplo de separação correta:**
```
RUIM: "Dormir menos de 6h causa diabetes tipo 2"
BOM:  "Privação crônica de sono está associada a maior resistência à insulina
       (dados observacionais, NHANES) — RCTs de longa duração ainda são limitados"
```

---

## 5. Claims sobre Exames e Produtos da BodyBase

### O que PODE ser dito:
- "A BodyBase mede [biomarcador X]"
- "Entenda o que seu [exame Y] significa"
- "Monitore [biomarcador] ao longo do tempo"
- "Compare seus resultados com referências de longevidade"
- "Veja o que a literatura diz sobre seu nível de [X]"

### O que NÃO PODE ser dito:
- "Nosso exame detecta [doença]" (device diagnóstico = área regulada)
- "Fazendo nosso exame você vai [desfecho de saúde]"
- "Substituímos o médico" (jamais)
- "Diagnóstico online" (proibido CFM)
- "Resultados garantidos" (sem garantias absolutas)

---

## 6. Checklist Pré-Publicação

Antes de qualquer tweet ser aprovado, verificar:

- [ ] Contém algum verbo proibido?
- [ ] Afirma causalidade onde só há correlação?
- [ ] Usa número sem fonte?
- [ ] Faz promessa de resultado individual?
- [ ] Pode ser interpretado como diagnóstico ou prescrição?
- [ ] Cita estudo animal/in vitro como se fosse evidência humana?

**Se qualquer resposta for "sim" → revisar antes de publicar.**
