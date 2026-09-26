# Voronoi Cells 站点编辑器

离线运行的 Voronoi（Voronoi diagram / Dirichlet tessellation）站点编辑器：
在 100～1000 的整数矩形区域内放置 2～30 个 ASCII 站点，
用**有理数半平面裁切**精确构造每个站点的凸单元，输出顶点、精确面积与
共享正长度边段的邻接站点；点击画布按**平方欧氏距离**查询最近站点，
等距时按站点 id 的 **ASCII 字节序**定归属。

React + TypeScript + SVG，无任何网络依赖；`cells` 服务（nginx 托管
Vite 构建产物）通过 Docker Compose 启动。

## 为什么不用画布像素猜边界

站点 A、B 的服务区边界是等距线 `|p-A|² = |p-B|²`，即直线

```
2(B-A)·p + (|A|²-|B|²) = 0
```

若把交点四舍五入到像素再画多边形，拖动站点后相邻单元会出现裂缝或重叠。
本项目中：

- 全部交点用 `bigint` 分子/分母的有理数（`src/lib/rat.ts`）精确表示；
- 每个单元 = 矩形依次被各条等距线对应的半平面
  `|p-A|² ≤ |p-B|²` 裁切（Sutherland–Hodgman，`src/lib/voronoi.ts`）；
- 相邻单元共享的是**同一组精确分数顶点**，SVG 只负责把这些坐标画出来，
  任意缩放下都无缝无叠；
- 面积由鞋带公式在有理数上计算，是精确分数；
- 最近站点查询只在模型整数坐标系用 `bigint` 平方距离比较，
  SVG 缩放/平移完全不影响归属。

边界归属规则（闭半平面，等距点同时属于两侧闭包，查询唯一胜者另定）：

- 距离严格小者胜；
- 等距时 id 按 **ASCII 字节（无符号 8 位）逐字节、短前缀在前**比较，
  靠前者胜，与站点声明顺序无关。

## 功能

- 顶部设置区域宽高（整数 100～1000）。
- 侧栏增删站点：唯一非空白 ASCII id；坐标必须是区域内整数；
  重合坐标拒绝。
- 画布拖动站点（吸附整数坐标，拖到重合/越界位置被拒绝并提示）。
- 点击画布任意位置 → 吸附整数查询点，显示命中站点，证据表列出每个站点的
  `Δx²+Δy²` 展开式、精确 d² 与判定（最近 / 等距 id 胜出 / 并列等距）。
- 单元卡片显示选中站点的精确顶点（分数）、精确面积（附十进制近似）
  与邻接站点；邻接按钮可跳转。
- 画布多边形、查询证据、列表全部来自同一个 `buildDiagram` /
  `nearestSite` 计算结果（`src/App.tsx` 中 `useMemo` 单一数据源）。

## 目录

```
src/lib/rat.ts          精确有理数（bigint 分子/正分母）
src/lib/voronoi.ts      半平面裁切、鞋带面积、邻接、最近查询、输入校验
src/lib/*.test.ts       Vitest 测试（见下）
src/components/Canvas.tsx    SVG 画布、拖动与点击查询
src/components/Panels.tsx    单元信息 + 距离证据表
src/components/SitePanel.tsx 站点表格与添加表单
src/App.tsx             单一计算结果，图形与列表共用
Dockerfile / nginx.conf / docker-compose.yml   cells 服务
```

## 本地开发

```bash
npm install        # 若 npm 报 arborist edgesOut 错误，使用 npm install --legacy-peer-deps
npm run dev        # http://localhost:5173
npm run build      # tsc 类型检查 + vite 产物到 dist/
npm test           # Vitest 一次性运行
```

## Docker Compose（cells 服务）

```bash
docker compose up --build -d
# 页面：http://localhost:8080
```

`cells` 服务多阶段构建：node:22 中 `npm ci && npm run build`，
nginx:alpine 托管纯静态 `dist/`，构建完成后运行期不访问外网。

## 测试

`npm test`（Vitest）覆盖：

- 有理数四则/约分/符号；
- **双站点平分**：整数平分线与半整数平分线（顶点精确为 `1/2` 分数），
  面积精确各半；
- **共线点**：三个共线站点切成等面积条，非相邻条不互为邻接；
- **角落裁切单元**：角站点被切成精确三角形，面积 800 / 补集 9200；
- 四角站点中心整数点四站点等距，id 字节序裁定；
- **小区域穷举整数查询点**：对区域内每一个整数点，
  - 最近站点（字节序裁断）的单元闭包必须包含该点；
  - 所有并列等距站点的单元也必须包含该点；
  - 更远站点的单元绝不能包含该点（不重不漏）；
- 100×100 真实尺寸五站点的逐点穷举（约 1 万个整数点）；
- 多组配置下单元精确面积之和恒等于矩形面积、邻接关系对称；
- 宽高/数量/id/ASCII/重合/越界等输入校验。
