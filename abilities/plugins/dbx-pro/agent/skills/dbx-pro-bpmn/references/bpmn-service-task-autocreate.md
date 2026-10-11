### serviceTask 自动创建 Java 类（用户未提供类名/表达式时）

> **触发条件：** 用户要配置 serviceTask 但没有提供 `className`、`expression` 或 `delegateExpr` 时，**必须按以下步骤自动创建 Java 类**，不能使用占位符或留空。

#### 自动创建流程

**Step A：确定后端项目路径**

从记忆（MEMORY.md）读取后端项目路径。如无记忆，询问用户并保存到记忆。

**Step B：查找 servicetask 包路径**

在后端项目中查找已有的 servicetask 包（包含 `JavaDelegate` 实现类的目录）：

```
Glob: **/servicetask/*.java  →  提取包名和目录路径
```

如未找到，在 BPM 模块（含 `joa-flowable` 或 `bpm-flowable` 关键字的模块）下创建 `servicetask` 包。

参考包结构（来自本地项目实测）：
```
jeecg-boot-module-joa-flowable
  └─ src/main/java/org/jeecg/modules/servicetask/
       ├─ TestDelegateExpression.java   ← 参考模板
       └─ TestClass.java
```

**Step C：根据流程 processKey 推导类名**

类名规则：将 processKey 转为大驼峰 + `ServiceTask` 后缀。

| processKey | 推导类名 |
|-----------|---------|
| `oa_doc_countersign_process` | `OaDocCountersignProcessServiceTask` |
| `leave_apply` | `LeaveApplyServiceTask` |
| `contract_approval` | `ContractApprovalServiceTask` |

Spring Bean 名（委托表达式）：类名首字母小写，如 `${oaDocCountersignProcessServiceTask}`。

**Step D：创建 Java 类文件**

使用 Write 工具在 Step B 确定的目录下创建类文件：

```java
package org.jeecg.modules.servicetask;

import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

/**
 * {流程中文名} - {节点名称}服务节点
 * 流程编码：{processKey}
 */
@Slf4j
@Component
public class {ClassName} implements JavaDelegate {

    @Override
    public void execute(DelegateExecution execution) {
        String processInstanceId = execution.getProcessInstanceId();
        String businessKey = execution.getProcessInstanceBusinessKey();
        log.info("======== {ClassName} 执行 ========= processInstanceId={}, businessKey={}",
                processInstanceId, businessKey);
        // TODO: 在此处添加业务逻辑
    }
}
```

**Step E：配置 serviceTask JSON**

类创建后，自动填入 serviceTask 配置：

```json
{
  "id": "svc_{processKey_short}",
  "type": "serviceTask",
  "name": "{节点名称}",
  "serviceType": "delegateExpression",
  "delegateExpr": "${beanName}"
}
```

**Step F：告知用户**

流程创建完成后，告知用户已自动创建的类：

```
已自动创建 Java 服务类：
  路径：{完整文件路径}
  类名：{ClassName}
  Bean：{beanName}
  委托表达式：${beanName}

请在 execute() 方法中填写您的业务逻辑。
```

---

