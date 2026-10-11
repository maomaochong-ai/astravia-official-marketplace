## 自定义开发表单（代码生成）关联流程时的前端代码变更

> **触发条件：** 当用户的表有 `bpm_status` 字段，或者要求为代码生成的模块创建审批流程时，前端代码需要做以下变更。
>
> **执行方式：**
> - 如果是通过 **Step 0.5 联合创建场景** 进入的，这些变更由 `jeecg-codegen` skill 在第 1 步生成代码时**自动完成**（在调用 jeecg-codegen 时在需求中明确要求包含 bpm_status 字段和 Form.vue）。
> - 如果是已有代码模块补充流程，则通过 `jeecg-codegen` skill 的**增量修改（场景C）**执行，或手动按以下清单逐一修改。

### 需要变更的文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `Entity.java` | 增量修改 | 添加 `bpmStatus` 字段 + `@Dict(dicCode = "bpm_status")` |
| `Flyway SQL` | 增量修改 | 添加 `bpm_status varchar(10)` 列 |
| `data.ts` | 增量修改 | columns 添加 `bpmStatus_dictText` 列 + 导出 `getBpmFormSchema()` 函数 |
| `List.vue` | **重新生成** | 添加流程提交/审批进度功能 |
| `Modal.vue` | 增量修改 | `import { formSchema }` 改为 `import { getBpmFormSchema }`，`schemas: formSchema` 改为 `schemas: getBpmFormSchema({})` |
| `Form.vue` | **新建** | BPM 流程审批表单组件 |

### 1. Entity.java — 添加 bpmStatus 字段

```java
//update-begin---author:ai ---date:YYYY-MM-DD  for：【xxx】添加流程状态字段-----------
/**流程状态*/
@Excel(name = "流程状态", width = 15, dicCode = "bpm_status")
@Dict(dicCode = "bpm_status")
@Schema(description = "流程状态")
private String bpmStatus;
//update-end---author:ai ---date:YYYY-MM-DD  for：【xxx】添加流程状态字段-----------
```

### 2. data.ts — 添加 usePermission + columns + getBpmFormSchema

**需要添加的 import 和初始化（文件顶部）：**
```typescript
import { usePermission } from '/@/hooks/web/usePermission';
const { isDisabledAuth, hasPermission, initBpmFormData } = usePermission();
```

**三个函数说明（来自 `/@/hooks/web/usePermission.ts`）：**

| 函数 | 用途 | 用法 |
|------|------|------|
| `initBpmFormData(_formData)` | 加载流程节点的字段权限配置到 usePermission 内部 | 在 `getBpmFormSchema` 中调用，传入流程表单的 formData |
| `hasPermission(code)` | 判断字段是否**可见**（type=1） | 用在 formSchema 的 `show` 属性中 |
| `isDisabledAuth(code)` | 判断字段是否**禁用**（type=2） | 用在 formSchema 的 `dynamicDisabled` 属性中 |

**权限控制原理：**
- 流程节点配置的字段权限存储在 `formData.permissionList` 中（由 BPM 引擎注入）
- `initBpmFormData` 将权限列表加载到 `usePermission` 内部
- `hasPermission(code)` 检查 `permissionList` 中 type=1（显示）的 action 是否包含该 code
- `isDisabledAuth(code)` 检查 `permissionList` 中 type=2（禁用）的 action 是否包含该 code
- code 格式：后端 `set_node_field_permissions` 配置的 `ruleCode`（如 `online:表名:字段名` 或自定义编码）

**columns 第一列添加流程状态：**
```typescript
export const columns: BasicColumn[] = [
  { title: '流程状态', align: 'center', dataIndex: 'bpmStatus_dictText' },
  // ... 其他列
];
```

**formSchema 中使用权限控制字段显示/禁用（示例）：**
```typescript
export const formSchema: FormSchema[] = [
  // 通过 hasPermission 控制字段可见性
  {
    label: '密码', field: 'password', component: 'InputPassword',
    show: ({ values }) => {
      return hasPermission('{{entityPackage}}:{{tableName}}:password');
    },
  },
  // 通过 isDisabledAuth 控制字段禁用
  {
    label: '金额', field: 'amount', component: 'InputNumber',
    dynamicDisabled: ({ values }) => {
      return isDisabledAuth('{{entityPackage}}:{{tableName}}:amount');
    },
  },
  // ... 其他字段
];
```

**getBpmFormSchema 函数（文件末尾）：**
```typescript
export function getBpmFormSchema(_formData): FormSchema[] {
  // 加载流程节点权限配置（必须在返回 formSchema 之前调用）
  initBpmFormData(_formData);
  // 默认和原始表单保持一致 如果流程中配置了权限数据，这里需要单独处理formSchema
  return formSchema;
}
```

> **重要：** `initBpmFormData(_formData)` 必须在 `return formSchema` 之前调用，否则 `hasPermission` 和 `isDisabledAuth` 无法读取到流程节点的权限配置。

### 3. Modal.vue — 替换 formSchema 为 getBpmFormSchema

> **重要：** Modal.vue 必须使用 `getBpmFormSchema` 替代 `formSchema`，否则流程节点配置的字段权限（如 `dynamicDisabled`、`show` 中的 `isDisabledAuth`/`hasPermission`）在普通新增/编辑弹窗中不会生效。传 `{}` 空对象时权限函数返回默认值，不影响正常使用。

**需要修改的两处：**

```typescript
// 修改前：
import { formSchema } from '../{{entityName}}.data';
// 修改后：
import { getBpmFormSchema } from '../{{entityName}}.data';

// 修改前：
schemas: formSchema,
// 修改后：
schemas: getBpmFormSchema({}),
```

> **原理：** `getBpmFormSchema({})` 内部调用 `initBpmFormData({})`，空对象不含 `permissionList`，`hasPermission` 返回 `true`（可见），`isDisabledAuth` 返回 `false`（不禁用），与原始 `formSchema` 行为一致。但在 BPM 流程表单（Form.vue）中，`formData` 包含流程注入的 `permissionList`，权限控制才会真正生效。

### 4. List.vue — 完整 BPM 功能变更

**需要添加的 import：**
```typescript
import { startProcess } from '/@/api/common/api';
```

**需要添加的组件（template 中 Modal 后面）：**
```html
<!-- 审批流程图 -->
<BpmPictureModal @register="registerBpmModal" />
```

**需要添加的变量：**
```typescript
const [registerBpmModal, { openModal: bpmPicModal }] = useModal();
```

**操作栏（getDropDownAction）变更 — 添加"发起流程"和"审批进度"：**
```typescript
function getDropDownAction(record) {
  let dropDownAction = [
    { label: '详情', onClick: handleDetail.bind(null, record) },
    { label: '删除', popConfirm: { title: '是否确认删除', confirm: handleDelete.bind(null, record), placement: 'topLeft' }, auth: '{{entityPackage}}:{{tableName}}:delete' },
    {
      label: '审批进度',
      onClick: handlePreviewPic.bind(null, record),
      ifShow: !!record.bpmStatus && record.bpmStatus !== '1',
    }
  ];
  // bpmStatus 为空或 '1'（未提交）时显示"发起流程"按钮
  if (!record.bpmStatus || record.bpmStatus === '1') {
    dropDownAction.push({
      label: '发起流程',
      popConfirm: { title: '确认提交流程吗？', confirm: handleProcess.bind(null, record), placement: 'topLeft' }
    });
  }
  return dropDownAction;
}
```

**需要添加的方法：**
```typescript
/**
 * 提交流程
 */
async function handleProcess(record) {
  let params = {
    flowCode: 'dev_{{tableName}}_001',    // 与流程关联的唯一编码一致
    id: record.id,
    formUrl: '{{viewDir}}/components/{{entityName}}Form',  // 指向 Form.vue（不是 Modal.vue）
    formUrlMobile: ''
  }
  await startProcess(params);
  handleSuccess();
}

/**
 * 审批进度
 */
async function handlePreviewPic(record) {
  bpmPicModal(true, {
    flowCode: 'dev_{{tableName}}_001',
    dataId: record.id,
  });
}
```

### 5. Form.vue — BPM 流程审批表单（新建文件）

路径：`src/views/{{viewDir}}/components/{{entityName}}Form.vue`

**完整模板：**
```vue
<template>
    <div style="min-height: 400px">
        <BasicForm @register="registerForm"></BasicForm>
        <div style="width: 100%;text-align: center" v-if="!formDisabled">
            <a-button @click="submitForm" pre-icon="ant-design:check" type="primary">提 交</a-button>
        </div>
    </div>
</template>

<script lang="ts">
    import {BasicForm, useForm} from '/@/components/Form/index';
    import {computed, defineComponent} from 'vue';
    import {defHttp} from '/@/utils/http/axios';
    import { propTypes } from '/@/utils/propTypes';
    import {getBpmFormSchema} from '../{{entityName}}.data';
    import {saveOrUpdate} from '../{{entityName}}.api';

    export default defineComponent({
        name: "{{entityName}}Form",
        components:{ BasicForm },
        props:{
            formData: propTypes.object.def({}),
            formBpm: propTypes.bool.def(true),
        },
        setup(props){
            const [registerForm, { setFieldsValue, setProps, getFieldsValue }] = useForm({
                labelWidth: 150,
                schemas: getBpmFormSchema(props.formData),
                showActionButtonGroup: false,
                baseColProps: {span: 24}
            });

            const formDisabled = computed(()=>{
                if(props.formData.disabled === false){
                    return false;
                }
                return true;
            });

            let formData = {};
            const queryByIdUrl = '/{{entityPackagePath}}/{{entityName_uncap}}/queryById';
            async function initFormData(){
                let params = {id: props.formData.dataId};
                const data = await defHttp.get({url: queryByIdUrl, params});
                formData = {...data}
                await setFieldsValue(formData);
                await setProps({disabled: formDisabled.value})
            }

            async function submitForm() {
                let data = getFieldsValue();
                let params = Object.assign({}, formData, data);
                console.log('表单数据', params)
                await saveOrUpdate(params, true)
            }

            initFormData();

            return { registerForm, formDisabled, submitForm }
        }
    });
</script>
```

**关键说明：**
- Form.vue 使用 `defineComponent`（Options API），不是 `<script setup>`
- 通过 `props.formData.dataId` 获取数据 ID，`props.formData.disabled` 控制表单禁用
- `getBpmFormSchema` 从 data.ts 导入，默认返回 formSchema
- `queryByIdUrl` 指向后端 `queryById` 接口
- `formUrl` 参数（List.vue 的 handleProcess 中）指向此 Form 组件路径（不含 `.vue` 后缀）

### 5.1 Form.vue（一对多子表）— 含子表节点字段权限控制

> 适用场景：主表 + 一对多子表（JVxeTable），需在流程节点上对主表字段和子表列分别配置显示/禁用权限。

**与单表 Form.vue 的区别：**

| 差异点 | 单表 Form.vue | 一对多 Form.vue |
|--------|--------------|----------------|
| 模板 | 仅 BasicForm | BasicForm + a-tabs + JVxeTable |
| 子表列权限 | 无 | `filterSubTableColnmns` 过滤 `subPermissionList` |
| 子表数据 | 无 | `purXxxTable.dataSource` 绑定，`initFormData` 加载 |
| submit | `getFieldsValue` | `getFieldsValue` + `ref.getTableData()` |

**完整模板：**

```vue
<template>
  <div style="min-height: 400px">
    <BasicForm @register="registerForm"></BasicForm>
    <!-- 子表tabs -->
    <a-tabs v-model:activeKey="activeKey" animated class="jeecg-tab">
      <a-tab-pane tab="{{subTableLabel}}" key="{{subTableKey}}" :forceRender="true">
        <JVxeTable
          keep-source
          resizable
          ref="{{subTableKey}}"
          :loading="{{subTableKey}}Table.loading"
          :columns="{{subTableKey}}Table.columns"
          :dataSource="{{subTableKey}}Table.dataSource"
          :height="300"
          :rowNumber="true"
          :rowSelection="!formDisabled"
          :disabled="formDisabled"
          :toolbar="!formDisabled"
        />
      </a-tab-pane>
    </a-tabs>
    <div style="width: 100%; text-align: center; margin-top: 8px" v-if="!formDisabled">
      <a-button @click="submitForm" pre-icon="ant-design:check" type="primary">提 交</a-button>
    </div>
  </div>
</template>

<script lang="ts">
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { computed, defineComponent, ref, reactive } from 'vue';
  import { defHttp } from '/@/utils/http/axios';
  import { propTypes } from '/@/utils/propTypes';
  import { JVxeTable } from '/@/components/jeecg/JVxeTable';
  import { getBpmFormSchema, {{subTableKey}}Columns } from '../{{entityName}}.data';
  import { saveOrUpdate } from '../{{entityName}}.api';

  export default defineComponent({
    name: '{{entityName}}Form',
    components: { BasicForm, JVxeTable },
    props: {
      formData: propTypes.object.def({}),
      formBpm: propTypes.bool.def(true),
    },
    setup(props) {
      const [registerForm, { setFieldsValue, setProps, getFieldsValue }] = useForm({
        labelWidth: 150,
        schemas: getBpmFormSchema(props.formData),
        showActionButtonGroup: false,
        baseColProps: { span: 24 },
      });

      const formDisabled = computed(() => {
        if (props.formData.disabled === false) {
          return false;
        }
        return true;
      });

      const activeKey = ref('{{subTableKey}}');
      // 子表 JVxeTable 实例引用，名称必须与模板 ref="{{subTableKey}}" 一致
      const {{subTableKey}} = ref();

      let mainFormData: any = {};
      const queryByIdUrl = '/{{entityPackagePath}}/{{entityName_uncap}}/queryById';
      const querySubUrl = '/{{entityPackagePath}}/{{entityName_uncap}}/query{{SubEntityName}}ByMainId';

      const {{subTableKey}}Table = reactive({
        loading: false,
        dataSource: [],
        // filterSubTableColnmns 根据 subPermissionList 过滤列的显示/禁用
        columns: filterSubTableColnmns({{subTableKey}}Columns, '{{permCodePrefix}}:'),
        show: false,
      });

      /**
       * 子表列权限过滤（从 props.formData.subPermissionList 读取节点配置的列权限）
       * @param columns  原始列配置数组
       * @param pre      流程节点上配置的权限编码前缀，如 'purApplyItemColumns:'
       */
      function filterSubTableColnmns(columns, pre) {
        let authList = props.formData.subPermissionList;
        // 未配置子表权限时原样返回
        if (!authList || authList.length === 0) {
          return columns;
        }
        return columns.filter(item => {
          let oneAuthList = authList.filter(auth => auth.action === pre + item.key);
          if (!oneAuthList || oneAuthList.length === 0) {
            return true;
          }
          let oneAuthHidden = oneAuthList.find(auth => auth.type == '1');
          let oneAuthDisable = oneAuthList.find(auth => auth.type == '2');
          // 隐藏逻辑（type=1 且无权限）
          if (oneAuthHidden && !oneAuthHidden.isAuth) {
            return false;
          }
          // 禁用逻辑（type=2 且无权限）
          if (oneAuthDisable && !oneAuthDisable.isAuth) {
            item['disabled'] = true;
          } else {
            item['disabled'] = false;
          }
          return true;
        });
      }

      async function initFormData() {
        let params = { id: props.formData.dataId };
        const data = await defHttp.get({ url: queryByIdUrl, params });
        mainFormData = { ...data };
        await setFieldsValue(mainFormData);
        await setProps({ disabled: formDisabled.value });
        // 加载子表数据
        if (props.formData.dataId) {
          {{subTableKey}}Table.loading = true;
          try {
            const items = await defHttp.get({ url: querySubUrl, params: { id: props.formData.dataId } });
            {{subTableKey}}Table.dataSource = items || [];
          } finally {
            {{subTableKey}}Table.loading = false;
          }
        }
      }

      async function submitForm() {
        let data = getFieldsValue();
        // 优先从 JVxeTable 实例获取含用户编辑的最新数据
        let items: any[] = {{subTableKey}}Table.dataSource;
        if ({{subTableKey}}.value?.getTableData) {
          items = {{subTableKey}}.value.getTableData() || {{subTableKey}}Table.dataSource;
        }
        let params = Object.assign({}, mainFormData, data, {
          {{subTableKey}}List: items,
        });
        await saveOrUpdate(params, true);
      }

      initFormData();

      return {
        registerForm,
        formDisabled,
        activeKey,
        {{subTableKey}},
        {{subTableKey}}Table,
        submitForm,
      };
    },
  });
</script>

<style lang="less" scoped>
  .jeecg-tab { padding: 0 20px; }
  :deep(.ant-input-number) { width: 100%; }
</style>
```

**模板变量说明：**

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `{{subTableLabel}}` | `采购明细` | tab 标签文字 |
| `{{subTableKey}}` | `purPurchaseApplyItem` | ref 名称、reactive key 名，需与 data.ts 中列变量名前缀对应 |
| `{{subTableKey}}Columns` | `purPurchaseApplyItemColumns` | data.ts 导出的子表列配置 |
| `{{permCodePrefix}}` | `purApplyItemColumns` | 流程节点上配置子表列权限时的编码前缀（不含末尾冒号） |
| `{{SubEntityName}}` | `PurPurchaseApplyItem` | 子表实体大驼峰名，用于拼接后端接口路径 |
| `{{subTableKey}}List` | `purPurchaseApplyItemList` | 提交时子表数组的字段名（与后端 DTO 一致） |

**关键注意事项：**

1. `filterSubTableColnmns` 读取 `props.formData.subPermissionList`（由 BPM 引擎注入），`subPermissionList` 为空时不过滤任何列，原样显示
2. 模板中 `ref="{{subTableKey}}"` 与 setup 返回的 `{{subTableKey}}` 变量名**必须一致**，否则 `getTableData()` 拿不到用户编辑的数据
3. 子表数据加载/loading 统一操作 `{{subTableKey}}Table.dataSource` 和 `{{subTableKey}}Table.loading`，不可另建独立 ref（模板绑定的是 reactive 对象）
4. `submitForm` 中优先用 `ref.value.getTableData()` 拿最新数据，降级到 `table.dataSource`
5. `getBpmFormSchema(props.formData)` 内部调用 `initBpmFormData(props.formData)`，确保主表字段的 `show`/`dynamicDisabled` 能读取到节点权限

### 5.2 Form.vue（含一对一子表）— 嵌入 BasicForm 子组件 + 节点字段权限控制

> 适用场景：主表 + 一对一子表（BasicForm 嵌入），需在流程节点上对一对一子表字段配置显示/禁用权限。

#### data.ts 中为一对一子表单独导出 getBpmFormSchemaOne

一对一子表需要独立的 `getBpmFormSchemaOne(formData)` 函数，同样调用 `initBpmFormData`：

```typescript
export function getBpmFormSchemaOne(formData): FormSchema[] {
  const { isDisabledAuth, hasPermission, initBpmFormData } = usePermission();
  initBpmFormData(formData);
  const bpmFormSchemaOne: FormSchema[] = [
    { label: '', field: 'id',     component: 'Input', show: false },
    { label: '', field: 'mainId', component: 'Input', show: false },
    {
      label: '客户名称', field: 'customerName', required: true, component: 'Input',
      dynamicDisabled: ({ values }) => isDisabledAuth('salOne:customerName'),
    },
    {
      label: '联系人', field: 'contactPerson', component: 'Input',
      show: ({ values }) => hasPermission('salOne:contactPerson'),
    },
    // ... 其他字段
  ];
  return bpmFormSchemaOne;
}
```

**ruleCode 命名约定（三类并存时区分前缀）：**

| 子表类型 | ruleCode 前缀 | 示例 |
|---------|--------------|------|
| 主表字段 | `{模块}:` | `sal:orderNo` |
| 一对一子表字段 | `{模块}One:` | `salOne:customerName` |
| 一对多子表列 | `{子表变量名}Columns:` | `salOrderItemColumns:productName` |

**formBizCode 统一用主表名**（三类权限记录的 formBizCode 均相同）：`sal_sales_order`

#### 一对一子表组件（XxxOneForm.vue）

```vue
<template>
  <BasicForm @register="registerForm" name="{{EntityName}}OneForm" class="basic-modal-form" />
</template>

<script lang="ts">
  import { defineComponent } from 'vue';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { getBpmFormSchemaOne } from '../{{EntityName}}.data';
  import { defHttp } from '/@/utils/http/axios';
  import { VALIDATE_FAILED } from '/@/utils/common/vxeUtils';
  import { propTypes } from '@/utils/propTypes';

  export default defineComponent({
    name: '{{EntityName}}OneForm',
    components: { BasicForm },
    emits: ['register'],
    props: {
      formData: propTypes.object.def({}),
      disabled: { type: Boolean, default: false },
    },
    setup(props, { emit }) {
      const [registerForm, { setProps, resetFields, setFieldsValue, getFieldsValue, validate, scrollToField }] = useForm({
        schemas: getBpmFormSchemaOne(props.formData),   // ← 传入 formData 激活节点权限
        showActionButtonGroup: false,
        baseColProps: { span: 12 },
      });

      /**
       * 初始化加载数据（由父组件 Form.vue 调用）
       * @param url  子表查询接口，如 /sal/salSalesOrder/querySalCustomerInfoByMainId
       * @param id   主表 ID
       */
      function initFormData(url, id) {
        if (id) {
          defHttp.get({ url, params: { id } }, { isTransformResponse: false }).then((res) => {
            if (res.success && res.result && res.result.length > 0) {
              setFieldsValue({ ...res.result[0] });
            }
          });
        }
        setProps({ disabled: props.disabled });
      }

      /** 获取表单数据（返回数组，与后端 List<Entity> 一致） */
      function getFormData() {
        let formData = getFieldsValue();
        Object.keys(formData).map((k) => {
          if (formData[k] instanceof Array) formData[k] = formData[k].join(',');
        });
        return [formData];
      }

      /** 表单校验 */
      function validateForm(index) {
        return new Promise((resolve, reject) => {
          validate()
            .then(() => resolve(undefined))
            .catch(({ errorFields }) =>
              reject({ error: VALIDATE_FAILED, index, errorFields, scrollToField })
            );
        });
      }

      return { registerForm, resetFields, initFormData, getFormData, validateForm };
    },
  });
</script>

<style lang="less" scoped>
  .basic-modal-form { overflow: auto; height: 280px; }
</style>
```

#### 父级 Form.vue 中嵌入一对一子表组件

在主 Form.vue 的 `<template>` 中通过 `ref` 引用子组件，调用其 `initFormData` / `getFormData` / `validateForm`：

```vue
<template>
  <div>
    <BasicForm @register="registerForm" />
    <!-- 一对一子表 -->
    <{{EntityName}}OneForm ref="oneFormRef" :formData="props.formData" :disabled="formDisabled" />
    <!-- 一对多子表（JVxeTable） -->
    ...
  </div>
</template>

<script lang="ts">
  // initFormData 中加载一对一数据
  const oneFormRef = ref();
  async function initFormData() {
    const data = await defHttp.get({ url: queryByIdUrl, params: { id: props.formData.dataId } });
    await setFieldsValue(data);
    // 加载一对一子表
    oneFormRef.value?.initFormData('/sal/salSalesOrder/querySalCustomerInfoByMainId', props.formData.dataId);
  }

  // submitForm 中收集一对一数据
  async function submitForm() {
    let data = getFieldsValue();
    let oneData = oneFormRef.value?.getFormData() || [];
    let params = Object.assign({}, mainFormData, data, {
      salCustomerInfoList: oneData,       // 一对一子表数据
      salOrderItemList: tableData,        // 一对多子表数据
    });
    await saveOrUpdate(params, true);
  }
</script>
```

#### 节点字段权限配置（一对一子表）

一对一子表字段的权限记录与主表字段写入同一批次，`formBizCode` 统一用主表名：

```python
perms = [
    # 主表字段
    {"ruleCode": "sal:orderNo",         "formBizCode": "sal_sales_order", ...},
    # 一对一子表字段（formBizCode 仍用主表名）
    {"ruleCode": "salOne:customerName", "formBizCode": "sal_sales_order", ...},
    {"ruleCode": "salOne:phone",        "formBizCode": "sal_sales_order", ...},
    # 一对多子表列（formBizCode 仍用主表名）
    {"ruleCode": "salOrderItemColumns:productName", "formBizCode": "sal_sales_order", ...},
]
```

> **是否需要 sys_permission？**
> 含一对多子表的表单（主表 + 一对一 + 一对多）属于"一对多场景"，全部字段（含一对一子表字段）均**不需要**添加 sys_permission，BPM 引擎直接通过 `formData.permissionList` 注入。

---

### flowCode 命名规则

`flowCode` 必须与流程关联表单时的 `relationCode` 一致：
- 自定义开发（formType=3）：`dev_{表名}_001`
- Online（formType=1）：`onl_{表名}`
- DesForm（formType=2）：`desform_{编码}`

---

