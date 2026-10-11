### apiTask 自动创建 API 接口（用户未提供 apiUrl 时）

> **触发条件：** 用户要配置 apiTask 但没有提供 `apiUrl` 时，**必须按以下步骤自动创建后端 Controller 接口**，不能使用占位符或留空。

#### 自动创建流程

**Step A：确定后端项目路径**

从记忆（MEMORY.md）读取后端项目路径。如无记忆，询问用户并保存到记忆。

**Step B：查找业务相关的 Controller**

在后端项目中按流程的业务模块查找已有 Controller：

```
Glob: **/controller/**/*Controller.java  →  找到同业务模块的 Controller
```

优先顺序：
1. 与流程 processKey 同名/同业务的 Controller（如 `oa_doc_countersign_process` → 找 `*DocCountersign*Controller.java`）
2. 同包下其他业务 Controller（如 `/joa/controller/`）作为**新建参考模板**

**Step C：推导接口路径与方法名**

根据流程 processKey 和节点名称推导：

| 要素 | 规则 | 示例 |
|------|------|------|
| Controller 类名 | 业务名大驼峰 + `Controller` | `JoaDocCountersignController` |
| 包路径 | 与同模块已有 Controller 同包 | `org.jeecg.modules.joa.controller` |
| RequestMapping | `/joa/{camelCase业务名}` | `/joa/joaDocCountersign` |
| 方法名 | 根据节点名称推导（`afterSubmit`/`notify`/`callback` 等） | `afterSubmit` |
| 请求方法 | 有副作用操作用 `POST`，纯查询用 `GET` | `POST` |
| 接口路径 | `/{RequestMapping}/{方法名}` | `/joa/joaDocCountersign/afterSubmit` |

**Step D：判断创建还是追加**

- 如果目标 Controller **已存在** → 在文件末尾的 `}` 前追加新方法（用 Edit 工具）
- 如果目标 Controller **不存在** → 用 Write 工具新建 Controller 文件

**新建 Controller 模板：**

```java
package {package};

import lombok.extern.slf4j.Slf4j;
import org.jeecg.common.api.vo.Result;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {业务中文名} - 流程服务接口
 * 流程编码：{processKey}
 */
@Slf4j
@RestController
@RequestMapping("{requestMapping}")
public class {ClassName} {

    /**
     * {节点名称}回调接口（流程 apiTask 节点调用）
     *
     * @param businessKey       业务主键（流程变量 ${businessKey}）
     * @param processInstanceId 流程实例ID（流程变量 ${processInstanceId}）
     */
    @PostMapping("{methodPath}")
    public Result<?> {methodName}(
            @RequestParam(required = false) String businessKey,
            @RequestParam(required = false) String processInstanceId) {
        log.info("===== {ClassName} {methodName} ===== businessKey={}, processInstanceId={}",
                businessKey, processInstanceId);
        // TODO: 在此处添加业务逻辑
        return Result.OK("处理成功");
    }
}
```

**Step E：配置 apiTask JSON**

接口创建后，自动填入 apiTask 配置：

```json
{
  "id": "api_{processKey_short}",
  "type": "apiTask",
  "name": "{节点名称}",
  "apiUrl": "{接口路径}",
  "method": "POST",
  "inputParamsList": [
    {"key": "businessKey",       "value": "${businessKey}"},
    {"key": "processInstanceId", "value": "${processInstanceId}"}
  ],
  "outputParamsList": [],
  "timeout": 30000,
  "retryCount": 3
}
```

**Step F：告知用户**

流程创建完成后，告知用户已自动创建的接口：

```
已自动创建 API 接口：
  文件路径：{完整文件路径}
  接口地址：POST {apiUrl}
  Controller：{完整类名}#{methodName}
  入参：businessKey（业务主键）、processInstanceId（流程实例ID）

请在方法体中填写您的业务逻辑。
```

---

