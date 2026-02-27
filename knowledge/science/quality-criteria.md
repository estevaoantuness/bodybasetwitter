# Critérios de Qualidade Científica

Framework para avaliar estudos antes de usar dados em tweets. Aplique este documento antes de publicar qualquer claim baseado em evidência.

---

## Tier System — Classificação de Estudos

### Tier A — Alta confiança (pode usar como claim)
- Meta-análise de múltiplos RCTs (com baixa heterogeneidade)
- RCT duplo-cego com n > 500, em humanos, com desfecho clínico relevante
- Estudos de coorte muito grandes (n > 100.000) com controles adequados (ex: NHANES, UK Biobank, Framingham)

**O que pode escrever**: "Evidências consistentes associam X a Y" / "Meta-análise de N estudos sugere..."

### Tier B — Confiança moderada (usar com contexto)
- RCT com n < 500 em humanos
- Coortes longas estabelecidas (Framingham, NHANES) para desfechos secundários
- Estudos observacionais bem-controlados (n > 10.000)
- Revisões sistemáticas sem meta-análise quantitativa

**O que pode escrever**: "Um estudo com N participantes encontrou..." / "Dados observacionais sugerem..."

### Tier C — Evidência limitada (usar com disclaimer claro)
- Estudos observacionais menores (n 100-10.000)
- Estudos crossover de curta duração
- Estudos piloto ou exploratórios com n < 100
- Estudos em populações específicas (generalização limitada)

**O que pode escrever**: "Um estudo piloto com N participantes observou..." / "Dados preliminares sugerem — requer confirmação"

### Tier D — Não usar como claim (apenas para mecanismo)
- Estudos em animais (roedores, primatas)
- Estudos in vitro (células em laboratório)
- Modelos computacionais / simulações
- Relatos de caso (n=1)
- Preprints sem peer-review (exceto com transparência explícita)

**O que pode escrever**: "O mecanismo proposto, estudado em modelos animais, é..." / "Em laboratório, observou-se que..."

---

## Checklist de 6 Perguntas — Antes de Publicar

Responda sim ou não para cada pergunta. **Qualquer "NÃO" nas perguntas 1-4 = revisar antes de publicar.**

### 1. A fonte do dado é rastreável?
- Sim: journal + ano + autores identificáveis, ou dataset público nomeado
- Não: "especialistas dizem", "pesquisas mostram", "estudos indicam" sem citar qual

**Se não → adicionar fonte ou remover o claim numérico**

### 2. O estudo é Tier B ou superior para humanos?
- Sim: continuar
- Não (animal, in vitro, piloto < 30): mencionar a limitação explicitamente no tweet

**Exemplo de uso correto de Tier D**: "O mecanismo pelo qual X ativa autofagia foi descrito em modelos celulares — dados em humanos ainda são limitados"

### 3. O tweet distingue correlação de causalidade?
- Sim: usa "associado a", "correlacionado com", "encontrou-se que"
- Não: usa "causa", "provoca", "leva a" sem ser RCT

**Se não → trocar verbo causal por linguagem de associação**

### 4. Algum verbo proibido está presente?
Verificar: trata / cura / previne / garante / elimina / protege / rejuvenesce / desintoxica

**Se sim → trocar por linguagem aprovada (ver brand/red-lines.md)**

### 5. O contexto do dado está claro?
- O n amostral está presente (ou pelo menos indicado como "grande" vs. "pequeno")?
- A população do estudo é relevante para o público da BodyBase?
- O desfecho medido é o que o tweet afirma?

**Se não → adicionar contexto ou simplificar o claim**

### 6. A limitação principal do estudo está representada?
- Tweets sobre estudos observacionais devem mencionar a limitação de inferência causal
- Tweets sobre estudos animais devem mencionar que dados humanos são limitados
- Tweets sobre n pequeno devem indicar que replicação é necessária

---

## Como Mencionar Limitação Sem Matar o Tweet

O tweet não precisa se tornar uma nota de rodapé. A limitação pode ser integrada naturalmente:

**Ruim (mata o tweet):**
```
Um estudo com n=42 em ratos mostrou que restrição calórica aumenta expectativa
de vida em 30%. No entanto, é importante ressaltar que este estudo tem diversas
limitações metodológicas e que não se pode extrapolar para humanos sem cautela...
```

**Bom (integra a limitação):**
```
Restrição calórica aumenta expectativa de vida em 30% — em roedores.

O que isso significa para humanos é mais complicado:
perda de músculo, compliance difícil, resultados divergentes em primatas.

O CALERIE Trial (humanos) mostrou efeitos positivos em biomarcadores,
mas ainda sem dados de longevidade de longa duração.

(Journal of Gerontology, 2022)
```

---

## Hierarquia de Evidências — Visual

```
     ▲ MAIS CONFIANÇA
     │
     │  META-ANÁLISE DE RCTs (Tier A)
     │  ──────────────────────────────
     │  RCT (Tier A/B)
     │  ──────────────────────────────
     │  COORTE LONGA (Tier A/B)
     │  ──────────────────────────────
     │  OBSERVACIONAL (Tier B/C)
     │  ──────────────────────────────
     │  ESTUDO PILOTO (Tier C)
     │  ──────────────────────────────
     │  ANIMAL / IN VITRO (Tier D)
     │
     ▼ MENOS CONFIANÇA
```

---

## Fontes Especiais — Tratamento

### Preprints (medRxiv, bioRxiv)
- Usar apenas se: resultado é relevante E o tweet deixa claro que não passou por peer-review
- Formato: "(medRxiv, jan 2024 — não peer-reviewed)"
- Não usar para claims de saúde pública sem confirmação

### Examine.com
- É curador, não fonte primária — cita os estudos originais
- Grade A/B do Examine = boa proxy para Tier A/B
- Sempre rastrear até o estudo original para claims específicos

### Jornalismo científico (ScienceAlert, Stat News, etc.)
- NUNCA citar jornalismo como fonte científica
- Usar para descobrir o estudo original; citar o estudo, não a matéria

### Livros populares (Attia, Sinclair, Rhonda Patrick)
- Têm curadoria de boa qualidade, mas são simplificações
- Rastrear até a referência original do capítulo quando possível
- "Peter Attia descreve em Outlive..." é aceitável como contexto, não como evidência primária

---

## Red Flags de Má Ciência

Sinais que um estudo não deve ser citado:

- Financiado exclusivamente pela empresa que vende o produto
- n < 20 sem replicação
- Desfecho substituto (biomarker) sem desfecho clínico
- Conflito de interesse não declarado dos autores
- Sensacionalismo no título do próprio paper ("X cura Y definitivamente")
- Extrapolação do título para além dos dados reais
- Estudo retraído (verificar Retraction Watch)
