# studentScoreExcel 使用手册

该模块基于 `exceljs` 生成学生德育分表格，导出列与表头完全依赖 `public/configs/student.js`，不做固定类别/固定字段的硬编码。

## 引入

```javascript
import { getStudentConfig } from '@/utils/config'
import { exportStudentScoresXlsx } from '@/utils/studentScoreExcel'

const studentConfig = await getStudentConfig()
```

## 导出

### exportStudentScoresXlsx

浏览器端导出并触发下载。

```javascript
await exportStudentScoresXlsx({
    filename: '德育分.xlsx',
    studentConfig,
    sheets: [
        {
            name: '总表',
            students,
            categories: ['基础分', '奖励分'],
        },
    ],
})
```

参数说明：

- `filename`: 下载文件名（建议包含年级/班级/时间戳）
- `studentConfig`: 必须传入 `public/configs/student.js`
- `sheets`: 工作表数组
    - `name`: 工作表名称
    - `students`: 学生对象数组（原始学生对象，不是 table 行数据）
    - `categories`（可选）: 需要导出的分类名数组（来自 `studentConfig.data.dyf` 的 key）
        - 省略或传空数组时，默认导出 `studentConfig.data.dyf` 中的全部分类（按配置顺序）

### 表头结构

- 表头两行：
    - 第 1 行：类别名（例如“基础分”“惩罚分”），并对同一类别的项目列做横向合并
    - 第 2 行：项目编号（来自 `studentConfig.data.dyf[*][*][*].number`）
- 对于不需要两行表头的列会纵向合并（第 1-2 行合并）：
    - 序号
    - 基本信息字段（来自 `studentConfig.data.personal` 的所有 key）
    - 各类别“xx总和”列
    - 最终“总分”列
- 每个分类在项目编号列之后会追加 1 列“xx总和”，最后追加“总分”列

### 数据来源规则

- 基本信息：按 `studentConfig.data.personal` 的 key 顺序，从 `student.data.personal[key].data` 读取
- 各项目分值：从 `student.data.dyf[category][...][...].score` 读取，按 `studentConfig.data.dyf` 的项目编号顺序输出
- 分类总和/总分：在导出时根据项目分值计算（保留 2 位小数）

## 性能建议

- `exceljs` 体积较大，模块内部已做懒加载并缓存加载结果，避免重复初始化
- 尽量传入原始 `students`，不要先把所有项目展开成扁平行对象再传入（会额外占用大量内存）
- 分类/项目过多时导出的列数会很大，这是配置驱动的自然结果；可通过 `categories` 参数限制导出范围
