# MEMORY.md - Long-term context

## 咖啡品牌落地页项目
- **仓库**: `XYMovo/SYSU-TEST`，GitHub Pages: `https://xymovo.github.io/SYSU-TEST/`
- **风格**: 粗野主义（Brutalist）+ 古风元素，高对比撞色、粗黑边框、噪声纹理、扫描线
- **设计偏好**: 单文件 HTML，零外部依赖（图片除外），表情符号/SVG 做图标
- **图片策略**: 使用 `picsum.photos/seed/rb-{id}/800/500`，每个产品用不同 seed，搭配 SVG fallback
- **产品架构**: 7款产品三级分类 — 单一产地（日出耶加/慧兰之心/普洱夜曲/肯尼亚之光）、拼配（晨曦序曲/暗夜交响）、限量（瑰夏幻境）
- **功能模块**: 产品详情页、购物车推荐、12题问卷、登录注册、3步结算
- **存储**: 购物车→`rbcart`，用户→`rbuser`/`rbusers`，问卷→`rbsurveys`
- **部署方式**: `git push` 到 GitHub，开启 Pages（master分支/root目录）
- **问卷管理台**: `survey-admin.html`，独立的仪表盘/数据分析/CSV导入导出/CRUD维护页面，数据与主站共享 localStorage
- **设计参考**: 瑞幸咖啡(系列化大图导航) + LK Coffee(模块化卖点拆解) 的产品风格

## 用户偏好
- 沟通：中文，简短查询，快速响应
- 输出：高度结构化，野蛮主义设计风格
- 交付物：单文件 HTML，浏览器直接运行
- 部署：GitHub Pages 优先
- GitHub 账号：XYMovo
