# R6：三阶段生命周期、AI理据评分与版本演进

## 本规范覆盖的错误口径

版本星级不是教师评分，也不是玩家意见平均数。由AI在固定维度下阅读需求、源码、QA和实际问题，给出阶段性评分、逐项理由、来源、风险及下一项验证。AI判断与自动测试事实必须分开，不伪造模型比赛、人工打分或已完成实机验收。

当前是第一阶段MVP的6/7，不能说整个产品已完成86%。本次不启动新阶段生产、不擅改预算、不改游戏或云服务。

## 三阶段与算法

1. MVP核心玩法定稿：7个验收项，当前6项有证据，最后是正常流程最终测试并冻结MVP范围。
2. 完整资产与视听呈现：8项，完整故事、引导、资产规格、视觉、音乐、音效、配音、集成验收。程序化原型资产不自动等于正式资产完成。
3. 平台发布、销售与长期服务运营准备：6项，发行商业方案、权利隐私平台要求、发行兼容、商店宣传、正式发布、运营能力准备。已有公网原型URL不是商业发布。长期运营本身是持续活动，100%仅能表示定义的发布/运营准备验收项已完成。

每阶段完成率＝已完成验收项/该阶段总项。总进度＝三个阶段完成率的算术平均。三个阶段等权，是里程碑覆盖率，不是工时、成本或周期估算。不凭空发明阶段工作量权重。当前(6/7 + 0/8 + 0/6)/3 = 28.6%；第一阶段85.7%，第二、三阶段暂计0%，表示尚无成套验收，不是现有资产不存在。

## AI星级

MVP评审维度：核心玩法/需求30，可玩性/输入/引导25，稳定性/证据20，MVP视听反馈15，可追溯与可交付性10。总分100，星级＝总分/20，保留一位小数。每个版本有自己的证据，禁止把另一个分支或云版本的验收直接套用。阶段二/三进入后须明确评分范围并重评，不能沿用MVP星级作为商业发行认证。

玩家体验表和通关测评继续保留，但与AI版本星级分开标注。最终测试由实际执行证据闭环，不存在“等待教师打星”门槛。

## 版本图

单一数据源version-lineage.json生成Mermaid与SVG，也生成可读的箭头解释。每条边须区分源码派生、仅复用需求、同分支大修、评审输入、主线选择、保留对照和待办。未完成节点使用虚线样式，历史日志阶段不冒充可恢复发行版。

三人组：旧单机反馈→同一新Brief→Astra/Opus独立发散；Astra输入/HUD修复→单机对照；Opus桌面初稿→触屏修复→单机与云端再发散→Cloud R1/R2；评审收敛选择Opus联机首推并保留单机。没有证据说明Astra代码合并进Opus，禁止画成已融合。

Martin：早期2D小样→补冒险→3D与镜头/战斗大修→V1历史；9/24新Brief驱动独立V2，不表示源码继承；正常流程→组合测试夹具失败→夹具与曝光修正→边界重跑→R6候选→最终测试待定稿。旧版、初稿和失败证据均保留。

## 不变项与回归要求

继续Opus首推，语言按钮常驻，中文页面显示English、英文页面显示中文。保留6位邀请码、3人上限、14任务与动态测评、单机入口、预算和学习记录。三阶段/AI评审/版本图均中英双语；检验公式、箭头含义、图渲染、触屏宽度、常驻语言按钮和草稿保留。R5黄金源与游戏/服务器文件不改写。

## English contract

Version stars are authored, evidence-based AI judgments, not teacher grades or player-vote averages. Use the stated 100-point MVP rubric, show reasons and source scope per version, and separate judgment from actual test outcomes.

The lifecycle is (1) MVP core-gameplay freeze, (2) complete story/guidance/visual/music/sound/voice assets and integration, (3) platform/sales release plus long-term service readiness. Overall is the mean of the three phase gate-completion rates, not a labour estimate. Current rates are 6/7, 0/8 and 0/6; overall 28.6%, MVP 85.7%. Existing prototype art/audio and online testing do not automatically complete phases 2 or 3. This revision defines those phases without authorizing their execution.

Typed lineage edges distinguish requirements reuse, source derivation, in-branch repair, review input and selection. Two implementation branches are not a source merge. Pending gates and historical-log-only nodes remain explicit. Mermaid/SVG and text explanations are generated from the same graph ledger.
