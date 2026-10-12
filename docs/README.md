# Documentacao EMPS

## Guias atuais

| Documento | Finalidade |
|---|---|
| [Execucao local](../STARTUP.md) | Instalar, configurar, iniciar e testar |
| [Arquitetura](../ARCHITECTURE.md) | Limites entre site, app, API, MySQL e GIE |
| [API V2](API_V2.md) | Contratos de integracao existentes |
| [Arquitetura V2](EMPS_V2_ARCHITECTURE.md) | Associacoes e entidades do dominio |
| [GIE V2](GIE_V2_HANDOFF.md) | Contratos e limitacoes de gerenciamento |
| [Remoto somente leitura](REMOTE_DEVELOPMENT_HOSTINGER.md) | Requisitos de acesso individual a VPS |
| [Politica de banco](DATABASE_CHANGE_POLICY.md) | Aprovacao de alteracoes estruturais |
| [Stripe Sandbox](STRIPE_SANDBOX.md) | Pagamentos de teste, sem chaves publicadas |
| [RFID / GoodWe pendente](RFID_GOODWE_INTEGRATION_PENDING.md) | Dependencias de integracao real |
| [Modelo de aprovacao](CHANGE_APPROVAL_TEMPLATE.md) | Revisao pelo grupo |

## Historico

`change-requests/` registra as alteracoes consolidadas. Esses registros sao
historicos, nao comandos para reaplicar migrations ou repetir alteracoes.
Capturas e PDFs anteriores com informacoes de operacao real ficam na copia
local privada; nao acompanham o repositorio publico.

[Publicacao e organizacao desta versao](change-requests/CR-2026-10-12-002-github-publication.md).
[Relatorio em PDF](change-requests/pdf/EMPS_ORGANIZACAO_GITHUB_2026-10-12.pdf).

Auditorias de infraestrutura, chaves, configuracoes individuais e inventarios
de contas foram mantidos fora desta publicacao. O repositorio nao concede
acesso ao banco oficial, mesmo para quem consegue clona-lo.
