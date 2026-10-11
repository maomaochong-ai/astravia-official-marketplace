export const menuData = [
  {
    id: '200',
    show: true,
    parentId: '0',
    name: '图表',
    compType: 'chart',
    compConfig: '',
    icon: 'JBar',
    children: [
      {
        id: '200200',
        parentId: '200',
        name: '柱形图',
        compType: '',
        compConfig: '',
        icon: 'JBar',
        children: [
          {
            id: '200200201',
            parentId: '200200',
            name: '基础柱形图',
            compType: 'JBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '苹果',
                  value: 1000,
                  type: '手机品牌',
                },
                {
                  name: '三星',
                  value: 5400,
                  type: '手机品牌',
                },
                {
                  name: '小米',
                  value: 800,
                  type: '手机品牌',
                },
                {
                  name: 'oppo',
                  value: 400,
                  type: '手机品牌',
                },
                {
                  name: 'vivo',
                  value: 10000,
                  type: '手机品牌',
                },
              ],
              option: {
                grid: {
                  show: false,
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  show: true,
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                tooltip: {
                  trigger: 'axis',
                  textStyle: {
                    color: '#EEF1FA',
                  },
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                  lineStyle: {
                    color: '#EEF1FA',
                  },
                },
                series: [
                  {
                    data: [],
                    type: 'bar',
                    barWidth: 40,
                    itemStyle: {
                      color: '#64b5f6',
                      borderRadius: 0,
                    },
                    label: { position: 'top' }
                  },
                ],
              },
            },
            icon: 'ic:baseline-bar-chart',
          },
          {
            id: '200200202',
            parentId: '200200',
            name: '堆叠柱形图',
            compType: 'JStackBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '1991',
                  value: 3,
                  type: 'Lon',
                },
                {
                  name: '1992',
                  value: 4,
                  type: 'Lon',
                },
                {
                  name: '1993',
                  value: 3.5,
                  type: 'Lon',
                },
                {
                  name: '1994',
                  value: 5,
                  type: 'Lon',
                },
                {
                  name: '1995',
                  value: 4.9,
                  type: 'Lon',
                },
                {
                  name: '1996',
                  value: 6,
                  type: 'Lon',
                },
                {
                  name: '1997',
                  value: 7,
                  type: 'Lon',
                },
                {
                  name: '1998',
                  value: 9,
                  type: 'Lon',
                },
                {
                  name: '1999',
                  value: 13,
                  type: 'Lon',
                },
                {
                  name: '1991',
                  value: 3,
                  type: 'Bor',
                },
                {
                  name: '1992',
                  value: 4,
                  type: 'Bor',
                },
                {
                  name: '1993',
                  value: 3.5,
                  type: 'Bor',
                },
                {
                  name: '1994',
                  value: 5,
                  type: 'Bor',
                },
                {
                  name: '1995',
                  value: 4.9,
                  type: 'Bor',
                },
                {
                  name: '1996',
                  value: 6,
                  type: 'Bor',
                },
                {
                  name: '1997',
                  value: 7,
                  type: 'Bor',
                },
                {
                  name: '1998',
                  value: 9,
                  type: 'Bor',
                },
                {
                  name: '1999',
                  value: 13,
                  type: 'Bor',
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                grid: {
                  top: 43,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'ic:outline-stacked-bar-chart',
          },
          {
            id: '200200203',
            parentId: '200200',
            name: '动态柱形图',
            compType: 'JDynamicBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                // {
                //   filed: '分组',
                //   mapping: '',
                // },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '1991',
                  value: 131,
                },
                {
                  name: '1992',
                  value: 141,
                },
                {
                  name: '1993',
                  value: 31.5,
                },
                {
                  name: '1994',
                  value: 53,
                },
                {
                  name: '1995',
                  value: 41.9,
                },
                {
                  name: '1996',
                  value: 61,
                },
                {
                  name: '1997',
                  value: 17,
                },
                {
                  name: '1998',
                  value: 19,
                },
                {
                  name: '1999',
                  value: 113,
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    show: true,
                    lineStyle: {
                      color: '#EEF1FA',
                    },
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                grid: {
                  top: 30,
                  bottom: 18,
                  right: 30,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'ph:chart-bar-horizontal-light',
          },
          {
            id: '1009386233476579328',
            parentId: '200200',
            name: '胶囊图',
            compType: 'JCapsuleChart',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '苹果',
                  value: 1000879,
                  type: '手机品牌',
                },
                {
                  name: '三星',
                  value: 3400879,
                  type: '手机品牌',
                },
                {
                  name: '小米',
                  value: 2300879,
                  type: '手机品牌',
                },
                {
                  name: 'oppo',
                  value: 5400879,
                  type: '手机品牌',
                },
                {
                  name: 'vivo',
                  value: 3400879,
                  type: '手机品牌',
                },
              ],
              option: {
                showValue: false,
                unit: '',
                customColor: [],
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
          {
            id: '200200208',
            parentId: '200200',
            name: '基础条形图',
            compType: 'JHorizontalBar',
            compConfig: {
              w: 480,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '苹果',
                  value: 12345,
                  type: '手机品牌',
                },
                {
                  name: '三星',
                  value: 100,
                  type: '手机品牌',
                },
                {
                  name: '小米',
                  value: 8000,
                  type: '手机品牌',
                },
                {
                  name: 'oppo',
                  value: 5000,
                  type: '手机品牌',
                },
                {
                  name: 'vivo',
                  value: 10000,
                  type: '手机品牌',
                },
              ],
              option: {
                grid: {
                  show: false,
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                xAxis: {
                  type: 'value',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                yAxis: {
                  yUnit:'',
                  type: 'category',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                  lineStyle: {
                    color: '#EEF1FA',
                  },
                },
                series: [
                  {
                    data: [],
                    type: 'bar',
                    barWidth: 20,
                    itemStyle: {
                      color: '#64b5f6',
                      borderRadius: 0,
                    },
                  },
                ],
              },
            },
            icon: 'ic:baseline-bar-chart',
          },
          {
            id: '1536952329568276481',
            parentId: '200200',
            name: '背景柱形图',
            compType: 'JBackgroundBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '苹果',
                  value: 1000,
                  type: '手机品牌',
                },
                {
                  name: '三星',
                  value: 3400,
                  type: '手机品牌',
                },
                {
                  name: '小米',
                  value: 2300,
                  type: '手机品牌',
                },
                {
                  name: 'oppo',
                  value: 5400,
                  type: '手机品牌',
                },
                {
                  name: 'vivo',
                  value: 3400,
                  type: '手机品牌',
                },
              ],
              option: {
                grid: {
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                  lineStyle: {
                    color: '#EEF1FA',
                  },
                },
                series: [
                  {
                    data: [],
                    type: 'bar',
                    barWidth: 40,
                    itemStyle: {
                      color: '#5470c6',
                      borderRadius: 0,
                    },
                    showBackground: true,
                    backgroundStyle: {
                      color: '#eee',
                    },
                  },
                ],
              },
            },
            icon: 'ic:baseline-bar-chart',
          },
          {
            id: '1536970245843996673',
            parentId: '200200',
            name: '对比柱形图',
            compType: 'JMultipleBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '1991',
                  value: 3,
                  type: 'Lon',
                },
                {
                  name: '1992',
                  value: 4,
                  type: 'Lon',
                },
                {
                  name: '1993',
                  value: 3.5,
                  type: 'Lon',
                },
                {
                  name: '1994',
                  value: 5,
                  type: 'Lon',
                },
                {
                  name: '1995',
                  value: 4.9,
                  type: 'Lon',
                },
                {
                  name: '1996',
                  value: 6,
                  type: 'Lon',
                },
                {
                  name: '1997',
                  value: 7,
                  type: 'Lon',
                },
                {
                  name: '1998',
                  value: 9,
                  type: 'Lon',
                },
                {
                  name: '1999',
                  value: 13,
                  type: 'Lon',
                },
                {
                  name: '1991',
                  value: 3,
                  type: 'Bor',
                },
                {
                  name: '1992',
                  value: 4,
                  type: 'Bor',
                },
                {
                  name: '1993',
                  value: 3.5,
                  type: 'Bor',
                },
                {
                  name: '1994',
                  value: 5,
                  type: 'Bor',
                },
                {
                  name: '1995',
                  value: 4.9,
                  type: 'Bor',
                },
                {
                  name: '1996',
                  value: 6,
                  type: 'Bor',
                },
                {
                  name: '1997',
                  value: 7,
                  type: 'Bor',
                },
                {
                  name: '1998',
                  value: 9,
                  type: 'Bor',
                },
                {
                  name: '1999',
                  value: 13,
                  type: 'Bor',
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                grid: {
                  top: 12,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [
                  {
                    barWidth: 15,
                    itemStyle: {
                      borderRadius: 0,
                    },
                  },
                ],
              },
            },
            icon: 'material-symbols:grouped-bar-chart',
          },
          {
            id: '1536977123995045890',
            parentId: '200200',
            name: '正负条形图',
            compType: 'JNegativeBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '周一',
                  value: 200,
                  type: '利润',
                },
                {
                  name: '周二',
                  value: 170,
                  type: '利润',
                },
                {
                  name: '周三',
                  value: 240,
                  type: '利润',
                },
                {
                  name: '周四',
                  value: 244,
                  type: '利润',
                },
                {
                  name: '周五',
                  value: 200,
                  type: '利润',
                },
                {
                  name: '周六',
                  value: 220,
                  type: '利润',
                },
                {
                  name: '周日',
                  value: 210,
                  type: '利润',
                },
                {
                  name: '周一',
                  value: 320,
                  type: '收入',
                },
                {
                  name: '周二',
                  value: 302,
                  type: '收入',
                },
                {
                  name: '周三',
                  value: 341,
                  type: '收入',
                },
                {
                  name: '周四',
                  value: 374,
                  type: '收入',
                },
                {
                  name: '周五',
                  value: 390,
                  type: '收入',
                },
                {
                  name: '周六',
                  value: 450,
                  type: '收入',
                },
                {
                  name: '周日',
                  value: 420,
                  type: '收入',
                },
                {
                  name: '周一',
                  value: -120,
                  type: '支出',
                },
                {
                  name: '周二',
                  value: -132,
                  type: '支出',
                },
                {
                  name: '周三',
                  value: -101,
                  type: '支出',
                },
                {
                  name: '周四',
                  value: -134,
                  type: '支出',
                },
                {
                  name: '周五',
                  value: -190,
                  type: '支出',
                },
                {
                  name: '周六',
                  value: -230,
                  type: '支出',
                },
                {
                  name: '周日',
                  value: -210,
                  type: '支出',
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                xAxis: {
                  type: 'value',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                grid: {
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'mdi:chart-gantt',
          },
          {
            id: '1011128533818966016',
            parentId: '200200',
            name: '百分比条形图',
            compType: 'JPercentBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  type: 'Asia',
                  name: '1750',
                  value: 502,
                },
                {
                  type: 'Asia',
                  name: '1800',
                  value: 635,
                },
                {
                  type: 'Asia',
                  name: '1850',
                  value: 809,
                },
                {
                  type: 'Asia',
                  name: '1900',
                  value: 947,
                },
                {
                  type: 'Asia',
                  name: '1950',
                  value: 1402,
                },
                {
                  type: 'Asia',
                  name: '1999',
                  value: 3634,
                },
                {
                  type: 'Asia',
                  name: '2050',
                  value: 5268,
                },
                {
                  type: 'Africa',
                  name: '1750',
                  value: 106,
                },
                {
                  type: 'Africa',
                  name: '1800',
                  value: 107,
                },
                {
                  type: 'Africa',
                  name: '1850',
                  value: 111,
                },
                {
                  type: 'Africa',
                  name: '1900',
                  value: 133,
                },
                {
                  type: 'Africa',
                  name: '1950',
                  value: 221,
                },
                {
                  type: 'Africa',
                  name: '1999',
                  value: 767,
                },
                {
                  type: 'Africa',
                  name: '2050',
                  value: 1766,
                },
                {
                  type: 'Europe',
                  name: '1750',
                  value: 163,
                },
                {
                  type: 'Europe',
                  name: '1800',
                  value: 203,
                },
                {
                  type: 'Europe',
                  name: '1850',
                  value: 276,
                },
                {
                  type: 'Europe',
                  name: '1900',
                  value: 408,
                },
                {
                  type: 'Europe',
                  name: '1950',
                  value: 547,
                },
                {
                  type: 'Europe',
                  name: '1999',
                  value: 729,
                },
                {
                  type: 'Europe',
                  name: '2050',
                  value: 628,
                },
              ],
              option: {
                yNameFontColor: '#fff',
                yNameFontSize: 12,
                xNameFontColor: '#fff',
                xNameFontSize: 12,
                legendLayout: 'horizontal',
                legendPosition: 'bottom',
                legendFontColor: '#fff',
                legendFontSize: 16,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
          {
            id: '1537325666777710594',
            parentId: '200200',
            name: '折柱图',
            compType: 'JMixLineBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              seriesType: [
                {
                  series: '降水量',
                  type: 'bar',
                },
                {
                  series: '温度',
                  type: 'line',
                },
              ],
              chartData: [
                {
                  name: '1991',
                  value: 110,
                  type: '降水量',
                },
                {
                  name: '1992',
                  value: 130,
                  type: '降水量',
                },
                {
                  name: '1993',
                  value: 113.5,
                  type: '降水量',
                },
                {
                  name: '1994',
                  value: 150,
                  type: '降水量',
                },
                {
                  name: '1995',
                  value: 240.9,
                  type: '降水量',
                },
                {
                  name: '1996',
                  value: 160,
                  type: '降水量',
                },
                {
                  name: '1997',
                  value: 97,
                  type: '降水量',
                },
                {
                  name: '1998',
                  value: 290,
                  type: '降水量',
                },
                {
                  name: '1999',
                  value: 230,
                  type: '降水量',
                },
                {
                  name: '1991',
                  value: 33,
                  type: '温度',
                },
                {
                  name: '1992',
                  value: 35,
                  type: '温度',
                },
                {
                  name: '1993',
                  value: 37,
                  type: '温度',
                },
                {
                  name: '1994',
                  value: 35,
                  type: '温度',
                },
                {
                  name: '1995',
                  value: 34.9,
                  type: '温度',
                },
                {
                  name: '1996',
                  value: 36,
                  type: '温度',
                },
                {
                  name: '1997',
                  value: 37,
                  type: '温度',
                },
                {
                  name: '1998',
                  value: 39,
                  type: '温度',
                },
                {
                  name: '1999',
                  value: 33,
                  type: '温度',
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                grid: {
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'ic:baseline-bar-chart',
          },
        ],
      },
      {
        id: '200201',
        parentId: '200',
        name: '饼状图',
        compType: '',
        compConfig: '',
        icon: 'JPie',
        children: [
          {
            id: '200200001',
            parentId: '200201',
            name: '饼图',
            compType: 'JPie',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1048,
                  name: 'vivo',
                },
                {
                  value: 735,
                  name: 'oppo',
                },
                {
                  value: 580,
                  name: '苹果',
                },
                {
                  value: 484,
                  name: '小米',
                },
                {
                  value: 300,
                  name: '三星',
                },
              ],
              option: {
                innerRadius: 60,
                outRadius: 100,
                grid: {
                  show: false,
                  top: 53,
                  left: 43,
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  subtext: '',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'item',
                },
                legend: {
                  orient: 'vertical',
                },
                series: [
                  {
                    name: '',
                    type: 'pie',
                    radius: '50%',
                    data: [],
                    emphasis: {
                      itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)',
                      },
                    },
                    label: { show: true },
                  },
                ],
              },
            },
            icon: 'ant-design:pie-chart-outlined',
          },
          {
            id: '200203',
            parentId: '200201',
            name: '南丁格尔玫瑰图',
            compType: 'JRose',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1048,
                  name: 'vivo',
                },
                {
                  value: 735,
                  name: 'oppo',
                },
                {
                  value: 580,
                  name: '苹果',
                },
                {
                  value: 484,
                  name: '小米',
                },
                {
                  value: 300,
                  name: '三星',
                },
              ],
              option: {
                grid: {
                  show: false,
                  top: 50,
                  left: 43,
                },
                title: {
                  text: '',
                  subtext: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'item',
                },
                legend: {
                  orient: 'vertical',
                },
                series: [
                  {
                    name: '南丁格尔玫瑰',
                    type: 'pie',
                    radius: '50%',
                    roseType: 'radius',
                    data: [],
                    emphasis: {
                      itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)',
                      },
                    },
                    label: {
                      show: true,
                    },
                  },
                ],
              },
            },
            icon: 'ant-design:pie-chart-outlined',
          },
          {
            id: '1011144678642974720',
            parentId: '200201',
            name: '旋转饼图',
            compType: 'JRotatePie',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1048,
                  name: 'vivo',
                },
                {
                  value: 735,
                  name: 'oppo',
                },
                {
                  value: 580,
                  name: '苹果',
                },
                {
                  value: 484,
                  name: '小米',
                },
                {
                  value: 300,
                  name: '三星',
                },
              ],
              option: {
                grid: {
                  show: false,
                  bottom: 115,
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  subtext: '',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'item',
                },
                legend: {
                  orient: 'vertical',
                },
                series: [
                  {
                    name: '',
                    type: 'pie',
                    data: [],
                    emphasis: {
                      itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)',
                      },
                    },
                  },
                ],
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '1537002903949037570',
        parentId: '200',
        name: '折线图',
        compType: 'line',
        compConfig: null,
        icon: 'JLine',
        children: [
          {
            id: '200202',
            parentId: '1537002903949037570',
            name: '基础折线图',
            compType: 'JLine',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1000,
                  name: '联想',
                },
                {
                  value: 7350,
                  name: '小米',
                },
                {
                  value: 5800,
                  name: '华为',
                },
                {
                  value: 6000,
                  name: '苹果',
                },
                {
                  value: 3000,
                  name: '戴尔',
                },
              ],
              option: {
                grid: {
                  show: false,
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  subtext: '',
                  left: 10,
                },
                series: [
                  {
                    data: [],
                    lineType: 'line',
                    type: 'line',
                    itemStyle: {
                      color: '#64b5f6',
                    },
                    label: {position: 'top'},
                  },
                ],
              },
            },
            icon: 'teenyicons:area-chart-outline',
          },
          {
            id: '1537284032572702721',
            parentId: '1537002903949037570',
            name: '平滑曲线图',
            compType: 'JSmoothLine',
            compConfig: {
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1000,
                  name: '联想',
                },
                {
                  value: 7350,
                  name: '小米',
                },
                {
                  value: 5800,
                  name: '华为',
                },
                {
                  value: 6000,
                  name: '苹果',
                },
                {
                  value: 3000,
                  name: '戴尔',
                },
              ],
              option: {
                grid: {
                  show: false,
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  subtext: '',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                series: [
                  {
                    data: [],
                    smooth: true,
                    type: 'line',
                    label: {position: 'top'},
                  },
                ],
              },
            },
            icon: 'mdi:chart-bell-curve',
          },
          {
            id: '1537283654863044610',
            parentId: '1537002903949037570',
            name: '阶梯折线图',
            compType: 'JStepLine',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1000,
                  name: '联想',
                },
                {
                  value: 7350,
                  name: '小米',
                },
                {
                  value: 5800,
                  name: '华为',
                },
                {
                  value: 6000,
                  name: '苹果',
                },
                {
                  value: 3000,
                  name: '戴尔',
                },
              ],
              option: {
                grid: {
                  show: false,
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  subtext: '',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                series: [
                  {
                    data: [],
                    step: 'middle',
                    type: 'line',
                    label: {
                      position: 'top'
                    }
                  },
                ],
              },
            },
            icon: 'mdi:chart-line',
          },
          {
            id: '200206',
            parentId: '1537002903949037570',
            name: '面积图',
            compType: 'JArea',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1048,
                  name: '华为',
                },
                {
                  value: 605,
                  name: 'vivo',
                },
                {
                  value: 580,
                  name: 'oppo',
                },
                {
                  value: 484,
                  name: '苹果',
                },
                {
                  value: 300,
                  name: '小米',
                },
              ],
              option: {
                grid: {
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  boundaryGap: false,
                  data: [],
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                series: [
                  {
                    data: [],
                    type: 'line',
                    areaStyleOpacity:0.5,
                    areaStyle: {},
                    label: { position: 'top' }
                  },
                ],
              },
            },
            icon: 'teenyicons:area-chart-solid',
          },
          {
            id: '1537004441727684609',
            parentId: '1537002903949037570',
            name: '对比折线图',
            compType: 'JMultipleLine',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '1991',
                  value: 3,
                  type: 'Lon',
                },
                {
                  name: '1992',
                  value: 4,
                  type: 'Lon',
                },
                {
                  name: '1993',
                  value: 3.5,
                  type: 'Lon',
                },
                {
                  name: '1994',
                  value: 5,
                  type: 'Lon',
                },
                {
                  name: '1995',
                  value: 4.9,
                  type: 'Lon',
                },
                {
                  name: '1996',
                  value: 6,
                  type: 'Lon',
                },
                {
                  name: '1997',
                  value: 7,
                  type: 'Lon',
                },
                {
                  name: '1998',
                  value: 9,
                  type: 'Lon',
                },
                {
                  name: '1999',
                  value: 13,
                  type: 'Lon',
                },
                {
                  name: '1991',
                  value: 6,
                  type: 'Bor',
                },
                {
                  name: '1992',
                  value: 8,
                  type: 'Bor',
                },
                {
                  name: '1993',
                  value: 7,
                  type: 'Bor',
                },
                {
                  name: '1994',
                  value: 10,
                  type: 'Bor',
                },
                {
                  name: '1995',
                  value: 11,
                  type: 'Bor',
                },
                {
                  name: '1996',
                  value: 4,
                  type: 'Bor',
                },
                {
                  name: '1997',
                  value: 20,
                  type: 'Bor',
                },
                {
                  name: '1998',
                  value: 16,
                  type: 'Bor',
                },
                {
                  name: '1999',
                  value: 9,
                  type: 'Bor',
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                grid: {
                  top: 12,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [{
                 lineType: 'line',
                 label: {position: 'top'},
                }],
              },
            },
            icon: 'ant-design:line-chart-outlined',
          },
          {
            id: '726723325897637888',
            parentId: '1537002903949037570',
            name: '双轴图',
            compType: 'DoubleLineBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              markLineConfig: {
                show: false,
                markLine: [],
              },
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              seriesType: [
                {
                  series: '降水量',
                  type: 'bar',
                  yIndex: '0',
                },
                {
                  series: '温度',
                  type: 'line',
                  yIndex: '1',
                },
              ],
              chartData: [
                {
                  name: '1991',
                  value: 110,
                  type: '降水量',
                },
                {
                  name: '1992',
                  value: 130,
                  type: '降水量',
                },
                {
                  name: '1993',
                  value: 113.5,
                  type: '降水量',
                },
                {
                  name: '1994',
                  value: 150,
                  type: '降水量',
                },
                {
                  name: '1995',
                  value: 240.9,
                  type: '降水量',
                },
                {
                  name: '1996',
                  value: 160,
                  type: '降水量',
                },
                {
                  name: '1997',
                  value: 97,
                  type: '降水量',
                },
                {
                  name: '1998',
                  value: 290,
                  type: '降水量',
                },
                {
                  name: '1999',
                  value: 230,
                  type: '降水量',
                },
                {
                  name: '1991',
                  value: 33,
                  type: '温度',
                },
                {
                  name: '1992',
                  value: 35,
                  type: '温度',
                },
                {
                  name: '1993',
                  value: 37,
                  type: '温度',
                },
                {
                  name: '1994',
                  value: 35,
                  type: '温度',
                },
                {
                  name: '1995',
                  value: 34.9,
                  type: '温度',
                },
                {
                  name: '1996',
                  value: 36,
                  type: '温度',
                },
                {
                  name: '1997',
                  value: 37,
                  type: '温度',
                },
                {
                  name: '1998',
                  value: 39,
                  type: '温度',
                },
                {
                  name: '1999',
                  value: 33,
                  type: '温度',
                },
              ],
              option: {
                barWidth: 15,
                borderRadius: 0,
                symbol: 'emptyCircle',
                symbolSize: 4,
                lineWidth: 1,
                lineType: 'line',
                areaStyleOpacity: 0,
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                    fontSize: '14',
                  },
                },
                legend: {
                  t: 0,
                },
                grid: {
                  top: 30,
                  bottom: 18,
                  right: 40,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: [
                  {
                    type: 'value',
                    yUnit:'',
                    axisLabel: {
                      color: '#EEF1FA',
                    },
                    splitLine: {
                      show: false,
                      interval: 2,
                      lineStyle: {
                        color: '#8F8D8D',
                      },
                    },
                  },
                  {
                    type: 'value',
                    yUnit:'',
                    axisLabel: {
                      color: '#EEF1FA',
                    },
                    splitLine: {
                      interval: 2,
                      lineStyle: {
                        color: '#8F8D8D',
                      },
                    },
                  },
                ],
                series: [],
              },
            },
            icon: 'material-symbols:ssid-chart',
          },
        ],
      },
      {
        id: '15341365037570',
        parentId: '200',
        name: '进度图',
        compType: 'bar',
        compConfig: null,
        icon: 'JProgress',
        children: [
          {
            id: '142855341365037570',
            parentId: '200',
            name: '基础进度图',
            compType: 'JCustomProgress',
            compConfig: {
              w: 450,
              h: 100,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '满意度',
                  value: 50,
                },
              ],
              option: {
                barWidth: 19,
                padding: 12,
                progressColor: '#76c7c0',
                backgroundColor: '#ffffff',

                titleColor: '#fff',
                titleFontSize: 16,
                titlePosition: 'top',

                valueColor: '#fff',
                valueFontSize: 16,
                valuePosition: 'middle',
                valueXOffset: 0,
                valueYOffset: 0,
              },
            },
            icon: 'ri:bar-chart-horizontal-line',
          },
          {
            id: '15341365037570',
            parentId: '200',
            name: '进度图',
            compType: 'JProgress',
            compConfig: {
              w: 450,
              h: 100,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '满意度',
                  value: 50,
                },
              ],
              option: {
                valueXOffset: 0,
                valueYOffset: 0,
                grid: {
                  show: false,
                  top: 0,
                  left: 0,
                  right: 55,
                  bottom: 0,
                  containLabel: true,
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    show: true,
                  },
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: false,
                  textStyle: {},
                },
                tooltip: {
                  confine: true,
                  trigger: 'axis',
                  axisPointer: {
                    type: 'none',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [
                  {
                    barWidth: 19,
                    realtimeSort: true,
                    label: {
                      show: false,
                      position: 'left',
                      formatter: '{c}%',
                      color: 'black',
                      fontSize: 24,
                    },
                    itemStyle: {
                      normal: {
                        barBorderRadius: 10,
                      },
                    },
                    color: '#FF9D00',
                    zlevel: 1,
                  },
                  {
                    type: 'bar',
                    barGap: '-100%',
                    color: '#9C9CA1',
                    barWidth: 19,
                    label: {
                      show: true,
                      valueAnimation: true,
                      position: 'right',
                      color: '#ffffff',
                      fontSize: 18,
                      formatter: '{c}',
                      offset: [0, 0],
                    },
                    itemStyle: {
                      normal: {
                        barBorderRadius: 10,
                      },
                    },
                  },
                ],
              },
            },
            icon: 'ri:bar-chart-horizontal-line',
          },
          {
            id: '1756448568525',
            parentId: '200',
            name: '列表进度图',
            compType: 'JListProgress',
            compConfig: {
              w: 530,
              h: 310,
              dataType: 1,
              timeOut: 0,
              chartData: ListProgressData,
              option: ListProgressOption,
            },
            icon: 'ri:bar-chart-horizontal-line',
          },
          {
            id: '1763535152921',
            parentId: '200',
            name: '圆形进度图',
            compType: 'JRoundProgress',
            compConfig: {
              w: 300,
              h: 300,
              dataType: 1,
              timeOut: 0,
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: roundProgressData,
              option: roundProgressOption,
            },
            icon: 'ri:bar-chart-horizontal-line',
          },
          {
            id: '1010847514343669760',
            parentId: '15341365037570',
            name: '水波图',
            compType: 'JLiquid',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 25,
                },
              ],
              option: {
                liquidType: 'circle',
                color: '#1E90FF',
                borderWidth: 2,
                distance: 1,
                borderColor: '#1E90FF',
                strokeOpacity: 0,
                count: 4,
                length: 128,
                textColor: '#ffffff',
                textFontSize: 30,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '15311165037570',
        parentId: '200',
        name: '象形图',
        compType: 'bar',
        compConfig: null,
        icon: 'JPictorialBar',
        children: [
          {
            id: '200207',
            parentId: '15311165037570',
            name: '象形柱图',
            compType: 'JPictorialBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/pictogram',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '驯鹿',
                  value: 123,
                  symbol:
                    'path://M-22.788,24.521c2.08-0.986,3.611-3.905,4.984-5.892 c-2.686,2.782-5.047,5.884-9.102,7.312c-0.992,0.005-0.25-2.016,0.34-2.362l1.852-0.41c0.564-0.218,0.785-0.842,0.902-1.347 c2.133-0.727,4.91-4.129,6.031-6.194c1.748-0.7,4.443-0.679,5.734-2.293c1.176-1.468,0.393-3.992,1.215-6.557 c0.24-0.754,0.574-1.581,1.008-2.293c-0.611,0.011-1.348-0.061-1.959-0.608c-1.391-1.245-0.785-2.086-1.297-3.313 c1.684,0.744,2.5,2.584,4.426,2.586C-8.46,3.012-8.255,2.901-8.04,2.824c6.031-1.952,15.182-0.165,19.498-3.937 c1.15-3.933-1.24-9.846-1.229-9.938c0.008-0.062-1.314-0.004-1.803-0.258c-1.119-0.771-6.531-3.75-0.17-3.33 c0.314-0.045,0.943,0.259,1.439,0.435c-0.289-1.694-0.92-0.144-3.311-1.946c0,0-1.1-0.855-1.764-1.98 c-0.836-1.09-2.01-2.825-2.992-4.031c-1.523-2.476,1.367,0.709,1.816,1.108c1.768,1.704,1.844,3.281,3.232,3.983 c0.195,0.203,1.453,0.164,0.926-0.468c-0.525-0.632-1.367-1.278-1.775-2.341c-0.293-0.703-1.311-2.326-1.566-2.711 c-0.256-0.384-0.959-1.718-1.67-2.351c-1.047-1.187-0.268-0.902,0.521-0.07c0.789,0.834,1.537,1.821,1.672,2.023 c0.135,0.203,1.584,2.521,1.725,2.387c0.102-0.259-0.035-0.428-0.158-0.852c-0.125-0.423-0.912-2.032-0.961-2.083 c-0.357-0.852-0.566-1.908-0.598-3.333c0.4-2.375,0.648-2.486,0.549-0.705c0.014,1.143,0.031,2.215,0.602,3.247 c0.807,1.496,1.764,4.064,1.836,4.474c0.561,3.176,2.904,1.749,2.281-0.126c-0.068-0.446-0.109-2.014-0.287-2.862 c-0.18-0.849-0.219-1.688-0.113-3.056c0.066-1.389,0.232-2.055,0.277-2.299c0.285-1.023,0.4-1.088,0.408,0.135 c-0.059,0.399-0.131,1.687-0.125,2.655c0.064,0.642-0.043,1.768,0.172,2.486c0.654,1.928-0.027,3.496,1,3.514 c1.805-0.424,2.428-1.218,2.428-2.346c-0.086-0.704-0.121-0.843-0.031-1.193c0.221-0.568,0.359-0.67,0.312-0.076 c-0.055,0.287,0.031,0.533,0.082,0.794c0.264,1.197,0.912,0.114,1.283-0.782c0.15-0.238,0.539-2.154,0.545-2.522 c-0.023-0.617,0.285-0.645,0.309,0.01c0.064,0.422-0.248,2.646-0.205,2.334c-0.338,1.24-1.105,3.402-3.379,4.712 c-0.389,0.12-1.186,1.286-3.328,2.178c0,0,1.729,0.321,3.156,0.246c1.102-0.19,3.707-0.027,4.654,0.269 c1.752,0.494,1.531-0.053,4.084,0.164c2.26-0.4,2.154,2.391-1.496,3.68c-2.549,1.405-3.107,1.475-2.293,2.984 c3.484,7.906,2.865,13.183,2.193,16.466c2.41,0.271,5.732-0.62,7.301,0.725c0.506,0.333,0.648,1.866-0.457,2.86 c-4.105,2.745-9.283,7.022-13.904,7.662c-0.977-0.194,0.156-2.025,0.803-2.247l1.898-0.03c0.596-0.101,0.936-0.669,1.152-1.139 c3.16-0.404,5.045-3.775,8.246-4.818c-4.035-0.718-9.588,3.981-12.162,1.051c-5.043,1.423-11.449,1.84-15.895,1.111 c-3.105,2.687-7.934,4.021-12.115,5.866c-3.271,3.511-5.188,8.086-9.967,10.414c-0.986,0.119-0.48-1.974,0.066-2.385l1.795-0.618 C-22.995,25.682-22.849,25.035-22.788,24.521z',
                  symbolSize: [60, 60],
                },
                {
                  name: '飞机',
                  value: 60,
                  symbol:
                    'path://M1.112,32.559l2.998,1.205l-2.882,2.268l-2.215-0.012L1.112,32.559z M37.803,23.96 c0.158-0.838,0.5-1.509,0.961-1.904c-0.096-0.037-0.205-0.071-0.344-0.071c-0.777-0.005-2.068-0.009-3.047-0.009 c-0.633,0-1.217,0.066-1.754,0.18l2.199,1.804H37.803z M39.738,23.036c-0.111,0-0.377,0.325-0.537,0.924h1.076 C40.115,23.361,39.854,23.036,39.738,23.036z M39.934,39.867c-0.166,0-0.674,0.705-0.674,1.986s0.506,1.986,0.674,1.986 s0.672-0.705,0.672-1.986S40.102,39.867,39.934,39.867z M38.963,38.889c-0.098-0.038-0.209-0.07-0.348-0.073 c-0.082,0-0.174,0-0.268-0.001l-7.127,4.671c0.879,0.821,2.42,1.417,4.348,1.417c0.979,0,2.27-0.006,3.047-0.01 c0.139,0,0.25-0.034,0.348-0.072c-0.646-0.555-1.07-1.643-1.07-2.967C37.891,40.529,38.316,39.441,38.963,38.889z M32.713,23.96 l-12.37-10.116l-4.693-0.004c0,0,4,8.222,4.827,10.121H32.713z M59.311,32.374c-0.248,2.104-5.305,3.172-8.018,3.172H39.629 l-25.325,16.61L9.607,52.16c0,0,6.687-8.479,7.95-10.207c1.17-1.6,3.019-3.699,3.027-6.407h-2.138 c-5.839,0-13.816-3.789-18.472-5.583c-2.818-1.085-2.396-4.04-0.031-4.04h0.039l-3.299-11.371h3.617c0,0,4.352,5.696,5.846,7.5 c2,2.416,4.503,3.678,8.228,3.87h30.727c2.17,0,4.311,0.417,6.252,1.046c3.49,1.175,5.863,2.7,7.199,4.027 C59.145,31.584,59.352,32.025,59.311,32.374z M22.069,30.408c0-0.815-0.661-1.475-1.469-1.475c-0.812,0-1.471,0.66-1.471,1.475 s0.658,1.475,1.471,1.475C21.408,31.883,22.069,31.224,22.069,30.408z M27.06,30.408c0-0.815-0.656-1.478-1.466-1.478 c-0.812,0-1.471,0.662-1.471,1.478s0.658,1.477,1.471,1.477C26.404,31.885,27.06,31.224,27.06,30.408z M32.055,30.408 c0-0.815-0.66-1.475-1.469-1.475c-0.808,0-1.466,0.66-1.466,1.475s0.658,1.475,1.466,1.475 C31.398,31.883,32.055,31.224,32.055,30.408z M37.049,30.408c0-0.815-0.658-1.478-1.467-1.478c-0.812,0-1.469,0.662-1.469,1.478 s0.656,1.477,1.469,1.477C36.389,31.885,37.049,31.224,37.049,30.408z M42.039,30.408c0-0.815-0.656-1.478-1.465-1.478 c-0.811,0-1.469,0.662-1.469,1.478s0.658,1.477,1.469,1.477C41.383,31.885,42.039,31.224,42.039,30.408z M55.479,30.565 c-0.701-0.436-1.568-0.896-2.627-1.347c-0.613,0.289-1.551,0.476-2.73,0.476c-1.527,0-1.639,2.263,0.164,2.316 C52.389,32.074,54.627,31.373,55.479,30.565z',
                  symbolSize: [65, 35],
                },
                {
                  name: '火箭',
                  value: 25,
                  symbol:
                    'path://M-244.396,44.399c0,0,0.47-2.931-2.427-6.512c2.819-8.221,3.21-15.709,3.21-15.709s5.795,1.383,5.795,7.325C-237.818,39.679-244.396,44.399-244.396,44.399z M-260.371,40.827c0,0-3.881-12.946-3.881-18.319c0-2.416,0.262-4.566,0.669-6.517h17.684c0.411,1.952,0.675,4.104,0.675,6.519c0,5.291-3.87,18.317-3.87,18.317H-260.371z M-254.745,18.951c-1.99,0-3.603,1.676-3.603,3.744c0,2.068,1.612,3.744,3.603,3.744c1.988,0,3.602-1.676,3.602-3.744S-252.757,18.951-254.745,18.951z M-255.521,2.228v-5.098h1.402v4.969c1.603,1.213,5.941,5.069,7.901,12.5h-17.05C-261.373,7.373-257.245,3.558-255.521,2.228zM-265.07,44.399c0,0-6.577-4.721-6.577-14.896c0-5.942,5.794-7.325,5.794-7.325s0.393,7.488,3.211,15.708C-265.539,41.469-265.07,44.399-265.07,44.399z M-252.36,45.15l-1.176-1.22L-254.789,48l-1.487-4.069l-1.019,2.116l-1.488-3.826h8.067L-252.36,45.15z',
                  symbolSize: [50, 60],
                },
                {
                  name: '高铁',
                  value: 18,
                  symbol:
                    'path://M67.335,33.596L67.335,33.596c-0.002-1.39-1.153-3.183-3.328-4.218h-9.096v-2.07h5.371 c-4.939-2.07-11.199-4.141-14.89-4.141H19.72v12.421v5.176h38.373c4.033,0,8.457-1.035,9.142-5.176h-0.027 c0.076-0.367,0.129-0.751,0.129-1.165L67.335,33.596L67.335,33.596z M27.999,30.413h-3.105v-4.141h3.105V30.413z M35.245,30.413 h-3.104v-4.141h3.104V30.413z M42.491,30.413h-3.104v-4.141h3.104V30.413z M49.736,30.413h-3.104v-4.141h3.104V30.413z  M14.544,40.764c1.143,0,2.07-0.927,2.07-2.07V35.59V25.237c0-1.145-0.928-2.07-2.07-2.07H-9.265c-1.143,0-2.068,0.926-2.068,2.07 v10.351v3.105c0,1.144,0.926,2.07,2.068,2.07H14.544L14.544,40.764z M8.333,26.272h3.105v4.141H8.333V26.272z M1.087,26.272h3.105 v4.141H1.087V26.272z M-6.159,26.272h3.105v4.141h-3.105V26.272z M-9.265,41.798h69.352v1.035H-9.265V41.798z',
                  symbolSize: [50, 30],
                },
                {
                  name: '轮船',
                  value: 12,
                  symbol:
                    'path://M16.678,17.086h9.854l-2.703,5.912c5.596,2.428,11.155,5.575,16.711,8.607c3.387,1.847,6.967,3.75,10.541,5.375 v-6.16l-4.197-2.763v-5.318L33.064,12.197h-11.48L20.43,15.24h-4.533l-1.266,3.286l0.781,0.345L16.678,17.086z M49.6,31.84 l0.047,1.273L27.438,20.998l0.799-1.734L49.6,31.84z M33.031,15.1l12.889,8.82l0.027,0.769L32.551,16.1L33.031,15.1z M22.377,14.045 h9.846l-1.539,3.365l-2.287-1.498h1.371l0.721-1.352h-2.023l-0.553,1.037l-0.541-0.357h-0.34l0.359-0.684h-2.025l-0.361,0.684 h-3.473L22.377,14.045z M23.695,20.678l-0.004,0.004h0.004V20.678z M24.828,18.199h-2.031l-0.719,1.358h2.029L24.828,18.199z  M40.385,34.227c-12.85-7.009-25.729-14.667-38.971-12.527c1.26,8.809,9.08,16.201,8.213,24.328 c-0.553,4.062-3.111,0.828-3.303,7.137c15.799,0,32.379,0,48.166,0l0.066-4.195l1.477-7.23 C50.842,39.812,45.393,36.961,40.385,34.227z M13.99,35.954c-1.213,0-2.195-1.353-2.195-3.035c0-1.665,0.98-3.017,2.195-3.017 c1.219,0,2.195,1.352,2.195,3.017C16.186,34.604,15.213,35.954,13.99,35.954z M23.691,20.682h-2.02l-0.588,1.351h2.023 L23.691,20.682z M19.697,18.199l-0.721,1.358h2.025l0.727-1.358H19.697z',
                  symbolSize: [50, 35],
                },
                {
                  name: '汽车',
                  value: 9,
                  symbol:
                    'path://M49.592,40.883c-0.053,0.354-0.139,0.697-0.268,0.963c-0.232,0.475-0.455,0.519-1.334,0.475 c-1.135-0.053-2.764,0-4.484,0.068c0,0.476,0.018,0.697,0.018,0.697c0.111,1.299,0.697,1.342,0.931,1.342h3.7 c0.326,0,0.628,0,0.861-0.154c0.301-0.196,0.43-0.772,0.543-1.78c0.017-0.146,0.025-0.336,0.033-0.56v-0.01 c0-0.068,0.008-0.154,0.008-0.25V41.58l0,0C49.6,41.348,49.6,41.09,49.592,40.883L49.592,40.883z M6.057,40.883 c0.053,0.354,0.137,0.697,0.268,0.963c0.23,0.475,0.455,0.519,1.334,0.475c1.137-0.053,2.762,0,4.484,0.068 c0,0.476-0.018,0.697-0.018,0.697c-0.111,1.299-0.697,1.342-0.93,1.342h-3.7c-0.328,0-0.602,0-0.861-0.154 c-0.309-0.18-0.43-0.772-0.541-1.78c-0.018-0.146-0.027-0.336-0.035-0.56v-0.01c0-0.068-0.008-0.154-0.008-0.25V41.58l0,0 C6.057,41.348,6.057,41.09,6.057,40.883L6.057,40.883z M49.867,32.766c0-2.642-0.344-5.224-0.482-5.507 c-0.104-0.207-0.766-0.749-2.271-1.773c-1.522-1.042-1.487-0.887-1.766-1.566c0.25-0.078,0.492-0.224,0.639-0.241 c0.326-0.034,0.345,0.274,1.023,0.274c0.68,0,2.152-0.18,2.453-0.48c0.301-0.303,0.396-0.405,0.396-0.672 c0-0.268-0.156-0.818-0.447-1.146c-0.293-0.327-1.541-0.49-2.273-0.585c-0.729-0.095-0.834,0-1.022,0.121 c-0.304,0.189-0.32,1.919-0.32,1.919l-0.713,0.018c-0.465-1.146-1.11-3.452-2.117-5.269c-1.103-1.979-2.256-2.599-2.737-2.754 c-0.474-0.146-0.904-0.249-4.131-0.576c-3.298-0.344-5.922-0.388-8.262-0.388c-2.342,0-4.967,0.052-8.264,0.388 c-3.229,0.336-3.66,0.43-4.133,0.576s-1.633,0.775-2.736,2.754c-1.006,1.816-1.652,4.123-2.117,5.269L9.87,23.109 c0,0-0.008-1.729-0.318-1.919c-0.189-0.121-0.293-0.225-1.023-0.121c-0.732,0.104-1.98,0.258-2.273,0.585 c-0.293,0.327-0.447,0.878-0.447,1.146c0,0.267,0.094,0.379,0.396,0.672c0.301,0.301,1.773,0.48,2.453,0.48 c0.68,0,0.697-0.309,1.023-0.274c0.146,0.018,0.396,0.163,0.637,0.241c-0.283,0.68-0.24,0.524-1.764,1.566 c-1.506,1.033-2.178,1.566-2.271,1.773c-0.139,0.283-0.482,2.865-0.482,5.508s0.189,5.02,0.189,5.86c0,0.354,0,0.976,0.076,1.565 c0.053,0.354,0.129,0.697,0.268,0.966c0.232,0.473,0.447,0.516,1.334,0.473c1.137-0.051,2.779,0,4.477,0.07 c1.135,0.043,2.297,0.086,3.33,0.11c2.582,0.051,1.826-0.379,2.928-0.36c1.102,0.016,5.447,0.196,9.424,0.196 c3.976,0,8.332-0.182,9.423-0.196c1.102-0.019,0.346,0.411,2.926,0.36c1.033-0.018,2.195-0.067,3.332-0.11 c1.695-0.062,3.348-0.121,4.477-0.07c0.886,0.043,1.103,0,1.332-0.473c0.132-0.269,0.218-0.611,0.269-0.966 c0.086-0.592,0.078-1.213,0.078-1.565C49.678,37.793,49.867,35.408,49.867,32.766L49.867,32.766z M13.219,19.735 c0.412-0.964,1.652-2.9,2.256-3.244c0.145-0.087,1.426-0.491,4.637-0.706c2.953-0.198,6.217-0.276,7.73-0.276 c1.513,0,4.777,0.078,7.729,0.276c3.201,0.215,4.502,0.611,4.639,0.706c0.775,0.533,1.842,2.28,2.256,3.244 c0.412,0.965,0.965,2.858,0.861,3.116c-0.104,0.258,0.104,0.388-1.291,0.275c-1.387-0.103-10.088-0.216-14.185-0.216 c-4.088,0-12.789,0.113-14.184,0.216c-1.395,0.104-1.188-0.018-1.291-0.275C12.254,22.593,12.805,20.708,13.219,19.735 L13.219,19.735z M16.385,30.511c-0.619,0.155-0.988,0.491-1.764,0.482c-0.775,0-2.867-0.353-3.314-0.371 c-0.447-0.017-0.842,0.302-1.076,0.362c-0.23,0.06-0.688-0.104-1.377-0.318c-0.688-0.216-1.092-0.155-1.316-1.094 c-0.232-0.93,0-2.264,0-2.264c1.488-0.068,2.928,0.069,5.621,0.826c2.693,0.758,4.191,2.213,4.191,2.213 S17.004,30.357,16.385,30.511L16.385,30.511z M36.629,37.293c-1.23,0.164-6.386,0.207-8.794,0.207c-2.412,0-7.566-0.051-8.799-0.207 c-1.256-0.164-2.891-1.67-1.764-2.865c1.523-1.627,1.24-1.576,4.701-2.023C24.967,32.018,27.239,32,27.834,32 c0.584,0,2.865,0.025,5.859,0.404c3.461,0.447,3.178,0.396,4.699,2.022C39.521,35.623,37.887,37.129,36.629,37.293L36.629,37.293z  M48.129,29.582c-0.232,0.93-0.629,0.878-1.318,1.093c-0.688,0.216-1.145,0.371-1.377,0.319c-0.231-0.053-0.627-0.371-1.074-0.361 c-0.448,0.018-2.539,0.37-3.313,0.37c-0.772,0-1.146-0.328-1.764-0.481c-0.621-0.154-0.966-0.154-0.966-0.154 s1.49-1.464,4.191-2.213c2.693-0.758,4.131-0.895,5.621-0.826C48.129,27.309,48.361,28.643,48.129,29.582L48.129,29.582z',
                  symbolSize: [40, 30],
                },
                {
                  name: '跑步',
                  value: 2,
                  symbol:
                    'path://M13.676,32.955c0.919-0.031,1.843-0.008,2.767-0.008v0.007c0.827,0,1.659,0.041,2.486-0.019 c0.417-0.028,1.118,0.325,1.14-0.545c0.014-0.637-0.156-1.279-0.873-1.367c-1.919-0.241-3.858-0.233-5.774,0.019 c-0.465,0.062-0.998,0.442-0.832,1.069C12.715,32.602,13.045,32.977,13.676,32.955z M14.108,29.013 c1.47-0.007,2.96-0.122,4.414,0.035c1.792,0.192,3.1-0.412,4.273-2.105c-3.044,0-5.882,0.014-8.719-0.01 c-0.768-0.005-1.495,0.118-1.461,1C12.642,28.731,13.329,29.014,14.108,29.013z M23.678,36.593c-0.666-0.69-1.258-1.497-2.483-1.448 c-2.341,0.095-4.689,0.051-7.035,0.012c-0.834-0.014-1.599,0.177-1.569,1.066c0.031,0.854,0.812,1.062,1.636,1.043 c1.425-0.033,2.852-0.01,4.278-0.01v-0.01c1.562,0,3.126,0.008,4.691-0.005C23.614,37.239,24.233,37.174,23.678,36.593z  M32.234,42.292h-0.002c-1.075,0.793-2.589,0.345-3.821,1.048c-0.359,0.193-0.663,0.465-0.899,0.799 c-1.068,1.623-2.052,3.301-3.117,4.928c-0.625,0.961-0.386,1.805,0.409,2.395c0.844,0.628,1.874,0.617,2.548-0.299 c1.912-2.573,3.761-5.197,5.621-7.814C33.484,42.619,33.032,42.387,32.234,42.292z M43.527,28.401 c-0.688-1.575-2.012-0.831-3.121-0.895c-1.047-0.058-2.119,1.128-3.002,0.345c-0.768-0.677-1.213-1.804-1.562-2.813 c-0.45-1.305-1.495-2.225-2.329-3.583c2.953,1.139,4.729,0.077,5.592-1.322c0.99-1.61,0.718-3.725-0.627-4.967 c-1.362-1.255-3.414-1.445-4.927-0.452c-1.933,1.268-2.206,2.893-0.899,6.11c-2.098-0.659-3.835-1.654-5.682-2.383 c-0.735-0.291-1.437-1.017-2.293-0.666c-2.263,0.927-4.522,1.885-6.723,2.95c-1.357,0.658-1.649,1.593-1.076,2.638 c0.462,0.851,1.643,1.126,2.806,0.617c0.993-0.433,1.994-0.857,2.951-1.374c1.599-0.86,3.044-0.873,4.604,0.214 c1.017,0.707,0.873,1.137,0.123,1.849c-1.701,1.615-3.516,3.12-4.933,5.006c-1.042,1.388-0.993,2.817,0.255,4.011 c1.538,1.471,3.148,2.869,4.708,4.315c0.485,0.444,0.907,0.896-0.227,1.104c-1.523,0.285-3.021,0.694-4.538,1.006 c-1.109,0.225-2.02,1.259-1.83,2.16c0.223,1.07,1.548,1.756,2.687,1.487c3.003-0.712,6.008-1.413,9.032-2.044 c1.549-0.324,2.273-1.869,1.344-3.115c-0.868-1.156-1.801-2.267-2.639-3.445c-1.964-2.762-1.95-2.771,0.528-5.189 c1.394-1.357,1.379-1.351,2.437,0.417c0.461,0.769,0.854,1.703,1.99,1.613c2.238-0.181,4.407-0.755,6.564-1.331 C43.557,30.447,43.88,29.206,43.527,28.401z',
                  symbolSize: [50, 50],
                },
                {
                  name: '步行',
                  value: 1,
                  symbol:
                    'path://M29.902,23.275c1.86,0,3.368-1.506,3.368-3.365c0-1.859-1.508-3.365-3.368-3.365 c-1.857,0-3.365,1.506-3.365,3.365C26.537,21.769,28.045,23.275,29.902,23.275z M36.867,30.74c-1.666-0.467-3.799-1.6-4.732-4.199 c-0.932-2.6-3.131-2.998-4.797-2.998s-7.098,3.894-7.098,3.894c-1.133,1.001-2.1,6.502-0.967,6.769 c1.133,0.269,1.266-1.533,1.934-3.599c0.666-2.065,3.797-3.466,3.797-3.466s0.201,2.467-0.398,3.866 c-0.599,1.399-1.133,2.866-1.467,6.198s-1.6,3.665-3.799,6.266c-2.199,2.598-0.6,3.797,0.398,3.664 c1.002-0.133,5.865-5.598,6.398-6.998c0.533-1.397,0.668-3.732,0.668-3.732s0,0,2.199,1.867c2.199,1.865,2.332,4.6,2.998,7.73 s2.332,0.934,2.332-0.467c0-1.401,0.269-5.465-1-7.064c-1.265-1.6-3.73-3.465-3.73-5.265s1.199-3.732,1.199-3.732 c0.332,1.667,3.335,3.065,5.599,3.399C38.668,33.206,38.533,31.207,36.867,30.74z',
                  symbolSize: [40, 50],
                },
              ],
              option: {
                title: {
                  show: true,
                  textAlign: 'left',
                  text: '',
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                grid: {
                  top: 60,
                  bottom: 18,
                  right: 50,
                  left: 25,
                  containLabel: true,
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'ant-design:dot-chart-outlined',
          },
          {
            id: '200218',
            parentId: '15311165037570',
            name: '象形图',
            compType: 'JPictorial',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/pictogram',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '驯鹿',
                  value: 123,
                },
                {
                  name: '飞机',
                  value: 60,
                },
                {
                  name: '火箭',
                  value: 25,
                },
                {
                  name: '高铁',
                  value: 18,
                },
                {
                  name: '轮船',
                  value: 12,
                },
                {
                  name: '汽车',
                  value: 9,
                },
                {
                  name: '跑步',
                  value: 2,
                },
                {
                  name: '步行',
                  value: 1,
                },
              ],
              option: {
                symbolSize: 30,
                symbolMargin: 0,
                symbol: '/img/bg/source/source1.svg',
                title: {
                  show: true,
                  textAlign: 'left',
                  text: '',
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                grid: {
                  top: 12,
                  bottom: 18,
                  right: 50,
                  left: 0,
                  containLabel: true,
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'ant-design:dot-chart-outlined',
          },
          {
            id: '1009335943687733248',
            parentId: '15311165037570',
            name: '男女占比',
            compType: 'JGender',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/pictogram',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '男',
                  mapping: '',
                },
                {
                  filed: '女',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  man: 50,
                  woman: 35,
                },
              ],
              option: {
                title: {
                  show: true,
                  textAlign: 'left',
                  text: '',
                },
                legend: {
                  t: 0,
                  r: 35,
                },
                grid: {
                  bottom: 115,
                },
                series: [],
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '200300',
        parentId: '200',
        name: '仪表盘',
        compType: '',
        compConfig: '',
        icon: 'JGauge',
        children: [
          {
            id: '200211',
            parentId: '200300',
            name: '基础仪表盘',
            compType: 'JGauge',
            compConfig: {
              w: 300,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/gauge',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '名称',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  min: 1,
                  max: 10,
                  label: '名称',
                  value: 4,
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  formatter: '{a} <br/>{b} : {c}%',
                },
                grid: {
                  top: 53,
                  left: 50,
                  containLabel: true,
                },
                series: [
                  {
                    axisLabel: {
                      show: true,
                      fontSize: 12,
                    },
                    detail: {
                      valueAnimation: true,
                      fontSize: 25,
                      formatter: '{value}',
                    },
                    splitLine: {
                      length: 15,
                      lineStyle: {
                        color: '#eee',
                        width: 4,
                      },
                    },
                    axisTick: {
                      show: true,
                      lineStyle: {
                        color: '#eee',
                      },
                    },
                    progress: {
                      show: true,
                    },
                    data: [],
                    itemStyle: {
                      color: '#64b5f6',
                    },
                    type: 'gauge',
                  },
                ],
              },
            },
            icon: 'mdi:gauge',
          },
          {
            id: '1501138710950854657',
            parentId: '200300',
            name: '多色仪表盘',
            compType: 'JColorGauge',
            compConfig: {
              w: 300,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/gauge',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '名称',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '使用率',
                  value: 4,
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  formatter: '{a} <br/>{b} : {c}%',
                },
                series: [
                  {
                    anchor: {
                      itemStyle: {
                        color: '#FAC858',
                      },
                    },
                    pointer: {
                      width: 8,
                    },
                    axisLabel: {
                      show: true,
                      fontSize: 12,
                    },
                    axisLine: {
                      lineStyle: {
                        width: 10,
                        color: [
                          [0.25, '#FF6E76'],
                          [0.5, '#FDDD60'],
                          [1, '#58D9F9'],
                        ],
                      },
                    },
                    splitLine: {
                      length: 15,
                      lineStyle: {
                        color: '#eee',
                        width: 4,
                      },
                    },
                    axisTick: {
                      show: true,
                      lineStyle: {
                        color: '#eee',
                      },
                    },
                    title: {
                      fontSize: 14,
                    },
                  },
                ],
              },
            },
            icon: 'mdi:gauge',
          },
          {
            id: '200300100100',
            parentId: '200300',
            name: '渐变仪表盘',
            compType: 'JAntvGauge',
            compConfig: {
              w: 300,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/gauge',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '名称',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  label: '使用率',
                  value: 4,
                },
              ],
              option: {
                gaugeType: '',
                gaugeWidth: 15,
                axisTickShow: true,
                lineColor: '#eee',
                axisLabelShow: true,
                axisLabelColor: '#fff',
                axisLabelFontSize: 15,
                valueFontSize: 30,
                valueColor: '#fff',
                indicatorColor: '#D0D0D0',
                indicatorLength: 8,
                colorType: '4',
                colors: [{ color1: '#67e0e3', color2: '' }],
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
              },
            },
            icon: 'mdi:gauge',
          },

          {
            id: '200300100101',
            parentId: '200300',
            name: '半圆仪表盘',
            compType: 'JSemiGauge',
            compConfig: {
              w: 500,
              h: 430,
              dataType: 1,
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '总计',
                  mapping: '',
                },
                {
                  filed: '已用',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  total: 800,
                  used: 400,
                },
              ],
              option: semiGaugeOption
            },
            icon: 'mdi:gauge',
          },
        ],
      },
      {
        id: '1537764165146476546',
        parentId: '200',
        name: '散点图',
        compType: 'scatter',
        compConfig: null,
        icon: 'JScatter',
        children: [
          {
            id: '1537318081257291777',
            parentId: '1537764165146476546',
            name: '普通散点图',
            compType: 'JScatter',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: 200,
                  value: 300,
                },
                {
                  name: 400,
                  value: 500,
                },
                {
                  name: 150,
                  value: 320,
                },
                {
                  name: 320,
                  value: 320,
                },
                {
                  name: 170,
                  value: 300,
                },
              ],
              option: {
                customColor: [],
                grid: {
                  show: false,
                  top: 12,
                  bottom: 18,
                  right: 50,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                tooltip: {
                  trigger: 'item',
                  formatter: 'x:{b}<br/>y:{c}',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    show: false,
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                  lineStyle: {
                    color: '#EEF1FA',
                  },
                },
                series: [
                  {
                    data: [],
                    type: 'scatter',
                    symbolSize: 20,
                    itemStyle: {
                      color: '#64b5f6',
                    },
                  },
                ],
              },
            },
            icon: 'mdi:chart-scatter-plot',
          },
          {
            id: '1734511486846',
            parentId: '1537764165146476546',
            name: '象限图',
            compType: 'JQuadrant',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              nameFields: [{ fieldTxt: '影响力' }],
              valueFields: [{ fieldTxt: '竞争力' }],
              chartData: [
                {
                  name: 95,
                  value: 95,
                  type: '北京',
                },
                {
                  name: 90,
                  value: 90,
                  type: '上海',
                },
                {
                  name: 80,
                  value: 70,
                  type: '深圳',
                },
                {
                  name: 60,
                  value: 50,
                  type: '重庆',
                },
                {
                  name: 80,
                  value: 60,
                  type: '天津',
                },
              ],
              option: {
                customColor: [],
                grid: {
                  show: false,
                  top: 45,
                  bottom: 18,
                  right: 20,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                },
                tooltip: {
                  trigger: 'item',
                  formatter: 'x:{b}<br/>y:{c}',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                xAxis: {
                  splitLine: {
                    show: false,
                  },
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    lineStyle: {
                      color: '#EEF1FA',
                    },
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                  axisLine: {
                    lineStyle: {
                      color: '#EEF1FA',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'mdi:chart-scatter-plot',
          },
          {
            id: '1537388686279196673',
            parentId: '1537764165146476546',
            name: '气泡图',
            compType: 'JBubble',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/stackedBar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: 4,
                  value: 3,
                  type: 'Lon',
                },
                {
                  name: 5,
                  value: 4,
                  type: 'Lon',
                },
                {
                  name: 6,
                  value: 3.5,
                  type: 'Lon',
                },
                {
                  name: 7,
                  value: 5,
                  type: 'Lon',
                },
                {
                  name: 8,
                  value: 4.9,
                  type: 'Lon',
                },
                {
                  name: 9,
                  value: 6,
                  type: 'Lon',
                },
                {
                  name: 10,
                  value: 7,
                  type: 'Lon',
                },
                {
                  name: 11,
                  value: 9,
                  type: 'Lon',
                },
                {
                  name: 12,
                  value: 13,
                  type: 'Lon',
                },
                {
                  name: 11,
                  value: 6,
                  type: 'Bor',
                },
                {
                  name: 10,
                  value: 8,
                  type: 'Bor',
                },
                {
                  name: 9,
                  value: 7,
                  type: 'Bor',
                },
                {
                  name: 8,
                  value: 10,
                  type: 'Bor',
                },
                {
                  name: 7,
                  value: 11,
                  type: 'Bor',
                },
                {
                  name: 6,
                  value: 4,
                  type: 'Bor',
                },
                {
                  name: 10,
                  value: 20,
                  type: 'Bor',
                },
                {
                  name: 8,
                  value: 16,
                  type: 'Bor',
                },
                {
                  name: 7,
                  value: 9,
                  type: 'Bor',
                },
              ],
              option: {
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                },
                yAxis: {
                  yUnit:'',
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    show: false,
                  },
                  splitLine: {
                    show: false,
                    interval: 2,
                    lineStyle: {
                      color: '#8F8D8D',
                    },
                  },
                },
                grid: {
                  top: 50,
                  bottom: 18,
                  right: 50,
                  left: 0,
                  containLabel: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: {
                    type: 'shadow',
                    label: {
                      show: true,
                      backgroundColor: '#333',
                    },
                  },
                },
                series: [],
              },
            },
            icon: 'mdi:chart-scatter-plot',
          },
        ],
      },
      {
        id: '1537764868216684545',
        parentId: '200',
        name: '漏斗图',
        compType: 'funnel',
        compConfig: null,
        icon: 'JFunnel',
        children: [
          {
            id: '200208',
            parentId: '1537764868216684545',
            name: '普通漏斗图',
            compType: 'JFunnel',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/funnel',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 335,
                  name: '直接访问',
                },
                {
                  value: 310,
                  name: '邮件营销',
                },
                {
                  value: 234,
                  name: '联盟广告',
                },
              ],
              option: {
                reversal: false,
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                grid: {
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'item',
                  formatter: '{a} <br/>{b} : {c}%',
                },
                legend: {
                  orient: 'horizontal',
                },
                series: [
                  {
                    name: 'Funnel',
                    type: 'funnel',
                    left: '10%',
                    right: '10%',
                    bottom: '5%',
                    sort: 'descending',
                    gap: 2,
                    label: {
                      show: true,
                      position: 'inside',
                    },
                    labelLine: {
                      length: 10,
                      lineStyle: {
                        width: 1,
                        type: 'solid',
                      },
                    },
                    itemStyle: {
                      borderColor: '#fff',
                      borderWidth: 1,
                    },
                    emphasis: {
                      label: {
                        fontSize: 20,
                      },
                    },
                  },
                ],
              },
            },
            icon: 'ant-design:funnel-plot-filled',
          },
          {
            id: '1537318433201340417',
            parentId: '1537764868216684545',
            name: '金字塔漏斗图',
            compType: 'JPyramidFunnel',
            compConfig: {
              w: 600,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/26/funnel',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1000,
                  name: '直接访问',
                },
                {
                  value: 200,
                  name: '邮件营销',
                },
                {
                  value: 400,
                  name: '联盟广告',
                },
                {
                  value: 600,
                  name: '网页查询',
                },
                {
                  value: 800,
                  name: '广告点击',
                },
              ],
              option: {
                reversal: false,
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                grid: {
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'item',
                  formatter: '{a} <br/>{b} : {c}%',
                },
                legend: {
                  orient: 'horizontal',
                },
                series: [
                  {
                    name: 'Funnel',
                    type: 'funnel',
                    left: '10%',
                    right: '10%',
                    sort: 'ascending',
                    bottom: 0,
                    gap: 2,
                    label: {
                      show: true,
                      position: 'inside',
                    },
                    labelLine: {
                      length: 10,
                      lineStyle: {
                        width: 1,
                        type: 'solid',
                      },
                    },
                    itemStyle: {
                      borderColor: '#fff',
                      borderWidth: 1,
                    },
                    emphasis: {
                      label: {
                        fontSize: 20,
                      },
                    },
                  },
                ],
              },
            },
            icon: 'icon-park-outline:children-pyramid',
          },
          {
            id: '1022233678642974720',
            parentId: '1537764868216684545',
            name: '3D金字塔',
            compType: 'JPyramid3D',
            compConfig: {
              w: 735,
              h: 485,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
                {
                  filed: '颜色',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: 'Java',
                  value: 800,
                  color: '#45fed4',
                },
                {
                  name: 'PHP',
                  value: 100,
                  color: '#84a9ef',
                },
                {
                  name: 'C#',
                  value: 50,
                  color: '#f1e04f',
                },
                {
                  name: 'Python',
                  value: 66,
                  color: '#dbfe73',
                },
              ],
              option: {
                zoom: 1,
                size: 'small',
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '1537773378102984706',
        parentId: '200',
        name: '雷达图',
        compType: 'radar',
        compConfig: null,
        icon: 'JRadar',
        children: [
          {
            id: '200204',
            parentId: '1537773378102984706',
            name: '普通雷达图',
            compType: 'JRadar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 75,
                  name: '得分',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 65,
                  name: '篮板',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 55,
                  name: '防守',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 74,
                  name: '失误',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 38,
                  name: '盖帽',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 88,
                  name: '三分',
                  type: 'NBA',
                  max: 100,
                },
              ],
              option: {
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                legend: {
                  data: [],
                },
                radar: [
                  {
                    indicator: [],
                  },
                ],
                series: [
                  {
                    type: 'radar',
                    data: [],
                  },
                ],
              },
            },
            icon: 'ant-design:radar-chart-outlined',
          },
          {
            id: '1537773244027863041',
            parentId: '1537773378102984706',
            name: '圆形雷达图',
            compType: 'JCircleRadar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              turnConfig: {
                url: '',
              },
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 75,
                  name: '得分',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 65,
                  name: '篮板',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 55,
                  name: '防守',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 74,
                  name: '失误',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 38,
                  name: '盖帽',
                  type: 'NBA',
                  max: 100,
                },
                {
                  value: 88,
                  name: '三分',
                  type: 'NBA',
                  max: 100,
                },
              ],
              option: {
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                legend: {
                  data: [],
                },
                radar: [
                  {
                    indicator: [],
                  },
                ],
                series: [
                  {
                    type: 'radar',
                    data: [],
                  },
                ],
              },
            },
            icon: 'tabler:radar',
          },
        ],
      },
      {
        id: '1534136503807570',
        parentId: '200',
        name: '环形图',
        compType: 'bar',
        compConfig: null,
        icon: 'JRing',
        children: [
          {
            id: '200205',
            parentId: '1534136503807570',
            name: '饼状环形图',
            compType: 'JRing',
            compConfig: {
              w: 480,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 1048,
                  name: 'oppo',
                },
                {
                  value: 735,
                  name: 'vivo',
                },
                {
                  value: 580,
                  name: '苹果',
                },
                {
                  value: 484,
                  name: '小米',
                },
                {
                  value: 300,
                  name: '三星',
                },
              ],
              option: {
                grid: {
                  show: false,
                  top: 50,
                  left: 50,
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                tooltip: {
                  trigger: 'item',
                },
                series: [
                  {
                    name: 'Access From',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    label: {
                      show: false,
                      position: 'center',
                    },
                    emphasis: {
                      label: {
                        show: true,
                        fontWeight: 'bold',
                        fontSize: 14,
                      },
                    },
                    labelLine: {
                      show: false,
                    },
                    data: [],
                  },
                ],
              },
            },
            icon: 'mdi:chart-donut',
          },
          {
            id: '1763464247522',
            parentId: '1534136503807570',
            name: '多色环形图',
            compType: 'JBreakRing',
            compConfig: {
              w: 550,
              h: 400,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: breakRingData,
              option: breakRingOption,
            },
            icon: 'mdi:chart-donut',
          },
          {
            id: '1011135678642974720',
            parentId: '1534136503807570',
            name: '基础环形图',
            compType: 'JRingProgress',
            compConfig: {
              w: 300,
              h: 200,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: 'Java',
                  value: 70,
                },
              ],
              option: {
                color: '#1E90FF',
                bgColor: '#E8EDF3',
                radius: 0.9,
                innerRadius: 0.9,
                lineHeight: 0,
                fontColor: '#ffffff',
                fontSize: 16,
                fontWeight: 'normal',
                valueFontSize: 16,
                valueFontColor: '#ffffff',
                valueFontWeight: 'normal',
              },
            },
            icon: null,
          },
          {
            id: '1009395760485793792',
            parentId: '1534136503807570',
            name: '动态环形图',
            compType: 'JActiveRing',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '周口',
                  value: 55,
                },
                {
                  name: '南阳',
                  value: 120,
                },
                {
                  name: '西峡',
                  value: 78,
                },
                {
                  name: '驻马店',
                  value: 66,
                },
                {
                  name: '新乡',
                  value: 80,
                },
              ],
              option: {
                lineWidth: 10,
                radius: 100,
                activeRadius: 120,
                showOriginValue: false,
                customColor: [],
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  textColor: '#ffffff',
                  textFontSize: 20,
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
          {
            id: '1011075798868328448',
            parentId: '1534136503807570',
            name: '玉珏图',
            compType: 'JRadialBar',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: 'A',
                  value: 297,
                },
                {
                  name: 'B',
                  value: 506,
                },
                {
                  name: 'C',
                  value: 805,
                },
                {
                  name: 'D',
                  value: 1478,
                },
                {
                  name: 'E',
                  value: 2029,
                },
                {
                  name: 'F',
                  value: 7100,
                },
                {
                  name: 'G',
                  value: 7346,
                },
                {
                  name: 'H',
                  value: 10178,
                },
              ],
              option: {
                type: 'bar',
                radius: 0.8,
                innerRadius: 0.2,
                maxAngle: 240,
                radiuShow: false,
                bgShow: false,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '153413650123456',
        parentId: '200',
        name: '矩形图',
        compType: 'bar',
        compConfig: null,
        icon: 'JRectangle',
        children: [
          {
            id: '1011137156657872896',
            parentId: '153413650123456',
            name: '矩形图',
            compType: 'JRectangle',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '分类 1',
                  value: 560,
                },
                {
                  name: '分类 2',
                  value: 500,
                },
                {
                  name: '分类 3',
                  value: 150,
                },
                {
                  name: '分类 4',
                  value: 140,
                },
                {
                  name: '分类 5',
                  value: 115,
                },
                {
                  name: '分类 6',
                  value: 95,
                },
                {
                  name: '分类 7',
                  value: 90,
                },
                {
                  name: '分类 8',
                  value: 75,
                },
                {
                  name: '分类 9',
                  value: 98,
                },
                {
                  name: '分类 10',
                  value: 60,
                },
                {
                  name: '分类 11',
                  value: 45,
                },
                {
                  name: '分类 12',
                  value: 40,
                },
                {
                  name: '分类 13',
                  value: 40,
                },
                {
                  name: '分类 14',
                  value: 35,
                },
                {
                  name: '分类 15',
                  value: 40,
                },
                {
                  name: '分类 16',
                  value: 40,
                },
                {
                  name: '分类 17',
                  value: 40,
                },
                {
                  name: '分类 18',
                  value: 30,
                },
                {
                  name: '分类 19',
                  value: 28,
                },
                {
                  name: '分类 20',
                  value: 16,
                },
              ],
              option: {
                theme: 'default',
                titleFontSize: 12,
                titleColor: '#fff',
                tipFontSize: 12,
                tipColor: '#fff',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '1735280687890',
        parentId: '200',
        name: '3D图表',
        compType: '3d',
        compConfig: null,
        icon: 'echarts-3d',
        children: [
          {
            id: '1735280856351',
            parentId: '1735280687890',
            name: '3D柱形图',
            compType: 'JBar3d',
            compConfig: {
              w: 490,
              h: 332,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '苹果',
                  value: 1000,
                },
                {
                  name: '三星',
                  value: 5400,
                },
                {
                  name: '小米',
                  value: 8000,
                },
                {
                  name: 'oppo',
                  value: 4000,
                },
                {
                  name: 'vivo',
                  type: '手机品牌',
                  value: 10000,
                },
              ],
              option: {
                graphic: {
                  children: [{ style: { fill: '#3f4867' } }],
                },
                grid: {
                  top: 20,
                  left: 0,
                  right: '1',
                  bottom: '36',
                  containLabel: true,
                },
                tooltip: {
                  show: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    lineStyle: {
                      color: '#EEF1FA00',
                    },
                  },
                },
                yAxis: {
                  yUnit:'',
                  show: true,
                  axisLabel: {
                    show: true,
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    lineStyle: {
                      color: '#EEF1FA',
                    },
                  },
                  splitLine: {
                    show: false,
                  },
                },
                series: [
                  {
                    id: 'barTopColor',
                    color: '#2DB1EF',
                  },
                  {
                    id: 'barBottomColor',
                    color: '#187dcb',
                  },
                  {
                    id: 'barColor',
                    color: '#115ba6',
                  },
                  {
                    id: 'shadowColor',
                    color: '#041133',
                  },
                  {
                    id: 'shadowTopColor',
                    color: '#142f5a',
                  },
                ],
              },
            },
            icon: null,
          },
          {
            id: '1735280856351',
            parentId: '1735280687890',
            name: '3D分组柱形图',
            compType: 'JBarGroup3d',
            compConfig: {
              w: 490,
              h: 332,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '1991销量',
                  value: 13000,
                  type: '小米',
                },
                {
                  name: '1992销量',
                  value: 12000,
                  type: '小米',
                },
                {
                  name: '1993销量',
                  value: 18000,
                  type: '小米',
                },
                {
                  name: '1991销量',
                  value: 10000,
                  type: '苹果',
                },
                {
                  name: '1992销量',
                  value: 11000,
                  type: '苹果',
                },
                {
                  name: '1993销量',
                  value: 23000,
                  type: '苹果',
                },
                {
                  name: '1991销量',
                  value: 3300,
                  type: '三星',
                },
                {
                  name: '1992销量',
                  value: 33000,
                  type: '三星',
                },
                {
                  name: '1993销量',
                  value: 18000,
                  type: '三星',
                },
                {
                  name: '1991销量',
                  value: 3500,
                  type: '华为',
                },
                {
                  name: '1992销量',
                  value: 35000,
                  type: '华为',
                },
                {
                  name: '1993销量',
                  value: 45000,
                  type: '华为',
                },
              ],
              option: {
                graphic: {
                  children: [{ style: { fill: '#3f4867' } }],
                },
                grid: {
                  top: 20,
                  left: 0,
                  right: '1',
                  bottom: '36',
                  containLabel: true,
                },
                tooltip: {
                  show: true,
                },
                xAxis: {
                  axisLabel: {
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    lineStyle: {
                      color: '#EEF1FA00',
                    },
                  },
                },
                yAxis: {
                  yUnit:'',
                  show: true,
                  axisLabel: {
                    show: true,
                    color: '#EEF1FA',
                  },
                  axisLine: {
                    lineStyle: {
                      color: '#EEF1FA',
                    },
                  },
                  splitLine: {
                    show: false,
                  },
                },
                series: [],
                seriesCustom: {
                  barTopColor: ['#0e4481', '#1e637b', '#5D7092', '#F6BD16', '#6F5EF9', '#6DC8EC', '#945FB9', '#FF9845', '#1E9493', '#FF99C3'],
                  barBottomColor: ['#0998d9', '#2ec6ad', '#6F5EF9', '#6DC8EC', '#945FB9', '#FF9845', '#1E9493', '#FF99C3', '#5B8FF9', '#61DDAA'],
                  barColor: ['#1370a7', '#4ebebe', '#3864ab', '#9c9c46', '#a6404b', '#ac582c', '#719c33', '#945FB9', '#FF9845', '#1E9493'],
                  shadowColor: ['#082442', '#0e2e3c', '#082442', '#0e2e3c', '#082442', '#0e2e3c', '#082442', '#0e2e3c', '#082442', '#0e2e3c'],
                  shadowTopColor: ['#0e4481', '#1e637b', '#5D7092', '#F6BD16', '#6F5EF9', '#6DC8EC', '#945FB9', '#FF9845', '#1E9493', '#FF99C3'],
                },
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '1735280687892',
        parentId: '200',
        name: '日历',
        compType: 'calendar',
        compConfig: null,
        icon: 'calendar',
        children: [
          {
            id: '1756792729039',
            parentId: '1735280687892',
            name: '日历',
            compType: 'JPermanentCalendar',
            compConfig: {
              w: 1000,
              h: 480,
              dataType: 1,
              timeOut: 0,
              linkageConfig: [],
              chartData: permanentCalendarData,
              option: permanentCalendarOption,
            },
            icon: null,
          },
        ],
      },
      {
        id: '1756869717059',
        parentId: '200',
        name: '轮播',
        compType: 'carousel',
        compConfig: null,
        icon: 'carousel',
        children: [
          {
            id: '1757057327940',
            parentId: '1756869717059',
            name: '卡片滚动(横向)',
            index: '1',
            compType: 'JCardScroll',
            compConfig: {
              w: 556,
              h: 255,
              dataType: 1,
              timeOut: 0,
              linkageConfig: [],
              chartData: cardScrollData,
              option: cardScrollOption,
            },
            icon: null,
          },
          {
            id: '1757057327940',
            parentId: '1756869717059',
            name: '卡片滚动(竖向+序号)',
            index: '2',
            compType: 'JCardScroll',
            compConfig: {
              w: 430,
              h: 530,
              dataType: 1,
              timeOut: 0,
              linkageConfig: [],
              chartData: cardScrollData1,
              option: cardScrollOption1,
            },
            icon: null,
          },
          {
            id: '1757057327940',
            parentId: '1756869717059',
            name: '卡片滚动(高亮)',
            index: '3',
            compType: 'JCardScroll',
            compConfig: {
              w: 538,
              h: 302,
              dataType: 1,
              timeOut: 0,
              linkageConfig: [],
              chartData: cardScrollData2,
              option: cardScrollOption2,
            },
            icon: null,
          },
          {
            id: '1756869734251',
            parentId: '1756869717059',
            name: '卡片轮播',
            compType: 'JCardCarousel',
            compConfig: {
              w: 1000,
              h: 230,
              dataType: 1,
              timeOut: 0,
              linkageConfig: [],
              chartData: cardCarouselData,
              option: cardCarouselOption,
            },
            icon: null,
          },
        ],
      },
      {
        id: '1762849143133',
        parentId: '200',
        name: '统计',
        compType: 'compare',
        compConfig: null,
        icon: 'compare',
        children: [
          {
            id: '1762849156848',
            parentId: '1762849143133',
            name: '统计概览（卡片模式）',
            compType: 'JStatsSummary',
            index: '1',
            compConfig: {
              w: 1000,
              h: 180,
              dataType: 1,
              timeOut: 0,
              chartData: statsSummaryData,
              option: statsSummaryCardOption,
            },
            icon: null,
          },
           {
            id: '1762942110042',
            parentId: '1762849143133',
            name: '统计概览（背景模式）',
            compType: 'JStatsSummary',
            index: '2',
            compConfig: {
              w: 713,
              h: 129,
              dataType: 1,
              timeOut: 0,
              chartData: statsSummaryData,
              option: statsSummaryOption,
            },
            icon: null,
          },
          {
            id: '1762942110000',
            parentId: '1762849143133',
            name: '统计概览（高亮模式）',
            compType: 'JStatsSummary',
            index: '3',
            compConfig: {
              w: 713,
              h: 106,
              dataType: 1,
              timeOut: 0,
              chartData: statsSummaryData,
              option: statsSummaryHighlightOption(),
            },
            icon: null,
          },
        ],
      },
    ],
  },
  {
    id: '15341365037580',
    show: true,
    parentId: '200',
    name: '装饰',
    compType: 'text',
    compConfig: null,
    icon: 'decorate',
    children: [
      {
        id: '1009728983979950080',
        parentId: '1009728871115423744',
        name: '边框',
        compType: 'border',
        compConfig: null,
        icon: 'JDragBorder',
        children: [
          {
            id: '1008616402292736000',
            parentId: '1009728983979950080',
            name: '边框1',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '1',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736002',
            parentId: '1009728983979950080',
            name: '边框2',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '2',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736003',
            parentId: '1009728983979950080',
            name: '边框3',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '3',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736004',
            parentId: '1009728983979950080',
            name: '边框4',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '4',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736005',
            parentId: '1009728983979950080',
            name: '边框5',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '5',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736006',
            parentId: '1009728983979950080',
            name: '边框6',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '6',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736007',
            parentId: '1009728983979950080',
            name: '边框7',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '7',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736008',
            parentId: '1009728983979950080',
            name: '边框8',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '8',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736009',
            parentId: '1009728983979950080',
            name: '边框9',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '9',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736010',
            parentId: '1009728983979950080',
            name: '边框10',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '10',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736011',
            parentId: '1009728983979950080',
            name: '边框11',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '11',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736012',
            parentId: '1009728983979950080',
            name: '边框12',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '12',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
          {
            id: '1008616402292736013',
            parentId: '1009728983979950080',
            name: '边框13',
            compType: 'JDragBorder',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              option: {
                type: '13',
                title: '边框',
                titleWidth: 250,
                mainColor: '#83bff6',
                subColor: '#00CED1',
                backgroundColor: '#ffffff00',
                reverse: false,
                dur: 3,
              },
            },
            icon: 'ant-design:border-outer-outlined',
          },
        ],
      },
      {
        id: '1009729002476830720',
        parentId: '1009728871115423744',
        name: '装饰',
        compType: 'decoration',
        compConfig: null,
        icon: 'JDragDecoration',
        children: [
          {
            id: '1008622512340893691',
            parentId: '1009729002476830720',
            name: '装饰1',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 100,
              dataType: 1,
              option: {
                type: '1',
                title: '装饰1',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1002122512340893691',
            parentId: '1009729002476830720',
            name: '装饰2',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 100,
              dataType: 1,
              option: {
                type: '2',
                title: '装饰2',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893693',
            parentId: '1009729002476830720',
            name: '装饰3',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 100,
              dataType: 1,
              option: {
                type: '3',
                title: '装饰3',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893694',
            parentId: '1009729002476830720',
            name: '装饰4',
            compType: 'JDragDecoration',
            compConfig: {
              w: 50,
              h: 300,
              dataType: 1,
              option: {
                type: '4',
                title: '装饰4',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893695',
            parentId: '1009729002476830720',
            name: '装饰5',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 100,
              dataType: 1,
              option: {
                type: '5',
                title: '装饰',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893696',
            parentId: '1009729002476830720',
            name: '装饰6',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 100,
              dataType: 1,
              option: {
                type: '6',
                title: '装饰6',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893697',
            parentId: '1009729002476830720',
            name: '装饰7',
            compType: 'JDragDecoration',
            compConfig: {
              w: 107,
              h: 50,
              dataType: 1,
              option: {
                type: '7',
                title: '装饰7',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893698',
            parentId: '1009729002476830720',
            name: '装饰8',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 100,
              dataType: 1,
              option: {
                type: '8',
                title: '装饰8',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893699',
            parentId: '1009729002476830720',
            name: '装饰9',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 300,
              dataType: 1,
              option: {
                type: '9',
                title: '装饰',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893610',
            parentId: '1009729002476830720',
            name: '装饰10',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 27,
              dataType: 1,
              option: {
                type: '10',
                title: '装饰10',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893611',
            parentId: '1009729002476830720',
            name: '装饰11',
            compType: 'JDragDecoration',
            compConfig: {
              w: 300,
              h: 100,
              dataType: 1,
              option: {
                type: '11',
                title: '装饰',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
          {
            id: '1008622512340893612',
            parentId: '1009729002476830720',
            name: '装饰12',
            compType: 'JDragDecoration',
            compConfig: {
              w: 150,
              h: 150,
              dataType: 1,
              option: {
                type: '12',
                title: '装饰',
                mainColor: '#00CED1',
                subColor: '#FAD400',
                reverse: false,
                dur: 3,
                fontSize: 15,
              },
            },
            icon: 'ant-design:format-painter-filled',
          },
        ],
      },
      {
        id: '15931993294',
        parentId: '15341365037580',
        name: '图片',
        compType: 'bar',
        compConfig: null,
        icon: 'JImg',
        children: [
          {
            id: '100109',
            parentId: '15931993294',
            name: '图片',
            compType: 'JImg',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/nav',
              timeOut: 0,
              linesConfig: {
                connectLine: [],
              },
              option: {
                izRotate: false,
                rotateTime: 1000,
                opacity: 1,
                borderRadius: 0,
                backgroundColor: '#FFFFFF00',
                padding: 0,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                body: {
                  url: 'https://static.jeecg.com/upload/test/df_1616583016208.png',
                },
              },
            },
            icon: 'ion:image-sharp',
          },
          {
            id: '1501033448017510401',
            parentId: '15931993294',
            name: '轮播图',
            compType: 'JCarousel',
            compConfig: {
              w: 600,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/carousel',
              timeOut: 0,
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '路径',
                  mapping: '',
                },
              ],
              option: {
                autoplay: true,
                dots: true,
                dotPosition: 'bottom',
              },
              chartData: [
                {
                  src: 'https://jeecgos.oss-cn-beijing.aliyuncs.com/files/site/drag/0.png',
                },
                {
                  src: 'https://jeecgos.oss-cn-beijing.aliyuncs.com/files/site/drag/1.png',
                },
                {
                  src: 'https://jeecgos.oss-cn-beijing.aliyuncs.com/files/site/drag/2.png',
                },
              ],
            },
            icon: 'ic:baseline-image',
          },
        ],
      },
      {
        id: '1734423034286',
        parentId: '15341365037580',
        name: '图标',
        icon: 'JCustomIcon',
        compType: 'JCustomIcon',
        children: [
          {
            compType: 'JCustomIcon',
            id: '1734423034287',
            name: '图标',
            parentId: '1734423034286',
            icon: '',
            compConfig: {
              type: '01',
              dataType: 1,
              w: 60,
              h: 60,
              option: {
                opacity: 1,
                filterfilter: 0,
                color: '#fff',
              },
            },
          },
        ],
      },
      {
        id: '1047797573274468352',
        parentId: '15341365037580',
        name: '图库',
        icon: 'JImg',
        compType: 'gallery',
        children: [],
      },
    ],
  },
  {
    id: '300000',
    show: true,
    parentId: '0',
    name: '文字',
    compType: 'text',
    compConfig: null,
    icon: 'JText',
    children: [
      {
        id: '300000100',
        parentId: '300000',
        name: '文本类',
        compType: 'bar',
        compConfig: null,
        icon: 'JText',
        children: [
          {
            id: '300000100100110',
            parentId: '300000100',
            name: '文本',
            compType: 'JText',
            compConfig: {
              w: 170,
              h: 60,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/nav',
              timeOut: 0,
              background: '#FFFFFF00',
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: {
                value: '我是展示文本',
              },
              option: {
                isLink: false,
                openType: '_blank',
                openUrl: '',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                body: {
                  text: '',
                  color: '#FFFFFF',
                  fontWeight: 'normal',
                  marginLeft: 0,
                  marginTop: 0,
                  letterSpacing: 0,
                },
                modal: {
                  title: '标题',
                  backgroundImage: '',
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center center',
                  sizeMode: 'full',
                  backgroundColor: '#363636',
                  titleBgColor: '#1F1F1F',
                },
              },
            },
            icon: 'ant-design:font-colors-outlined',
          },
          {
            id: '1008904673035976704',
            parentId: '300000100',
            name: '翻牌器',
            compType: 'JCountTo',
            compConfig: {
              w: 300,
              h: 80,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/nav',
              timeOut: 0,
              background: '#FFFFFF00',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              chartData: {
                value: 10000,
              },
              option: {
                whole: false,
                boxWidth: 50,
                boxHeight: 50,
                fontSize: 16,
                color: '#fff',
                fontWeight: 'normal',
                textAlign: 'center',
                prefixFontSize: 16,
                prefixColor: '#fff',
                prefixFontWeight: 'normal',
                prefixTextAlign: 'left',
                prefixGridX: 0,
                prefixGridY: 0,
                suffix: '',
                suffixGridX: 0,
                suffixGridY: 0,
                suffixFontSize: 16,
                suffixColor: '#fff',
                suffixFontWeight: 'normal',
                suffixTextAlign: 'left',
                prefix: '',
                type: 'border',
                borderColor: '#31aefd',
                backgroundImg: '',
                borderImg: '',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                body: {
                  text: '',
                  color: '#FFFFFF',
                  fontWeight: 'bold',
                  marginLeft: 0,
                  marginTop: 0,
                },
              },
            },
            icon: null,
          },
          {
            id: '1009345312659767296',
            parentId: '300000100',
            name: '颜色块',
            compType: 'JColorBlock',
            compConfig: {
              w: 450,
              h: 175,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/nav',
              timeOut: 0,
              background: '#FFFFFF00',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '前缀',
                  mapping: '',
                },
                {
                  filed: '后缀',
                  mapping: '',
                },
                {
                  filed: '背景色',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              chartData: [
                {
                  backgroundColor: '#67C23A',
                  prefix: '朝阳总销售额',
                  value: '12345',
                  suffix: '亿',
                },
                {
                  backgroundColor: '#409EFF',
                  prefix: '昌平总销售额',
                  value: '12345',
                  suffix: '亿',
                },
                {
                  backgroundColor: '#E6A23C',
                  prefix: '海淀总销售额',
                  value: '12345',
                  suffix: '亿',
                },
                {
                  backgroundColor: '#F56C6C',
                  prefix: '西城总销售额',
                  value: '12345',
                  suffix: '亿',
                },
              ],
              option: {
                whole: false,
                width: 50,
                height: 50,
                lineNum: 2,
                borderSplitx: 20,
                borderSplity: 20,
                decimals: 0,
                fontSize: 16,
                color: '#fff',
                fontWeight: 'normal',
                textAlign: 'center',
                padding: 5,
                prefixFontSize: 16,
                prefixColor: '#fff',
                prefixFontWeight: 'normal',
                prefixSplitx: 0,
                prefixSplity: 0,
                suffix: '',
                suffixSplitx: 40,
                suffixFontSize: 16,
                suffixColor: '#fff',
                suffixFontWeight: 'normal',
                prefix: '',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                body: {
                  text: '',
                  color: '#FFFFFF',
                  fontWeight: 'bold',
                  marginLeft: 0,
                  marginTop: 0,
                },
              },
            },
            icon: null,
          },
          {
            id: '932219134883299328',
            parentId: '300000100',
            name: '当前时间',
            compType: 'JCurrentTime',
            compConfig: {
              w: 280,
              h: 33,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/nav',
              timeOut: 0,
              background: '#FFFFFF00',
              chartData: '',
              option: {
                showWeek: 'show',
                hourlySystem: '12',
                format: 'YYYY-MM-DD hh:mm:ss',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                body: {
                  text: '',
                  color: '#FFFFFF',
                  fontWeight: 'normal',
                  marginLeft: 0,
                  marginTop: 0,
                  letterSpacing: 0,
                },
              },
            },
            icon: 'ant-design:field-time-outlined',
          },
          {
            id: '725214423934730240',
            parentId: '300000100',
            name: '数值',
            compType: 'JNumber',
            compConfig: {
              w: 100,
              h: 33,
              dataType: 1,
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              dataMapping: [
                {
                  filed: '数值',
                  mapping: '',
                }
              ],
              chartData: {
                value: 1024,
              },
              analysis: {
                isCompare: false,
                compareType: '',
                trendType: '1',
              },
              option: {
                isCompare: false,
                trendType: '1',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'small',
                  textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#464646',
                  },
                },
                body: {
                  text: '',
                  color: '#FFFFFF',
                  fontWeight: 'normal',
                  marginLeft: 0,
                  marginTop: 0,
                },
              },
            },
            icon: 'ant-design:field-number-outlined',
          },
          {
            id: '1756202727368',
            parentId: '300000100',
            name: '轨道环形文字',
            compType: 'JOrbitRing',
            compConfig: {
              w: 750,
              h: 540,
              dataType: 1,
              timeOut: 0,
              dataMapping: [
                {
                  filed: '标题',
                  mapping: 'name',
                },
                {
                  filed: 'id(唯一标识)',
                  mapping: 'value',
                },
                {
                  filed: '图片地址',
                  mapping: 'imgSrc',
                },
              ],
              chartData: orbitRingData,
              option: orbitRingOption,
            },
            icon: 'ant-design:field-number-outlined',
          },
        ],
      },
      {
        id: '300000200',
        parentId: '300000',
        name: '字符云',
        compType: 'bar',
        compConfig: null,
        icon: 'JImgWordCloud',
        children: [
          {
            id: '1011137154469872896',
            parentId: '300000200',
            name: '字符云',
            compType: 'JWordCloud',
            compConfig: {
              w: 650,
              h: 400,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 9,
                  name: 'AntV',
                },
                {
                  value: 8,
                  name: 'F2',
                },
                {
                  value: 8,
                  name: 'G2',
                },
                {
                  value: 8,
                  name: 'G6',
                },
                {
                  value: 8,
                  name: 'DataSet',
                },
                {
                  value: 8,
                  name: '墨者学院',
                },
                {
                  value: 6,
                  name: 'Analysis',
                },
                {
                  value: 6,
                  name: 'Data Mining',
                },
                {
                  value: 6,
                  name: 'Data Vis',
                },
                {
                  value: 6,
                  name: 'Design',
                },
                {
                  value: 6,
                  name: 'Grammar',
                },
                {
                  value: 6,
                  name: 'Graphics',
                },
                {
                  value: 6,
                  name: 'Graph',
                },
                {
                  value: 6,
                  name: 'Hierarchy',
                },
                {
                  value: 6,
                  name: 'Labeling',
                },
                {
                  value: 6,
                  name: 'Layout',
                },
                {
                  value: 6,
                  name: 'Quantitative',
                },
                {
                  value: 6,
                  name: 'Relation',
                },
                {
                  value: 6,
                  name: 'Statistics',
                },
                {
                  value: 6,
                  name: '可视化',
                },
                {
                  value: 6,
                  name: '数据',
                },
                {
                  value: 6,
                  name: '数据可视化',
                },
                {
                  value: 4,
                  name: 'Arc Diagram',
                },
                {
                  value: 4,
                  name: 'Bar Chart',
                },
                {
                  value: 4,
                  name: 'Canvas',
                },
                {
                  value: 4,
                  name: 'Chart',
                },
                {
                  value: 4,
                  name: 'DAG',
                },
                {
                  value: 4,
                  name: 'DG',
                },
                {
                  value: 4,
                  name: 'Facet',
                },
                {
                  value: 4,
                  name: 'Geo',
                },
                {
                  value: 4,
                  name: 'Line',
                },
                {
                  value: 4,
                  name: 'MindMap',
                },
                {
                  value: 4,
                  name: 'Pie',
                },
                {
                  value: 4,
                  name: 'Pizza Chart',
                },
                {
                  value: 4,
                  name: 'Punch Card',
                },
                {
                  value: 4,
                  name: 'SVG',
                },
                {
                  value: 4,
                  name: 'Sunburst',
                },
                {
                  value: 4,
                  name: 'Tree',
                },
                {
                  value: 4,
                  name: 'UML',
                },
                {
                  value: 3,
                  name: 'Chart',
                },
                {
                  value: 3,
                  name: 'View',
                },
                {
                  value: 3,
                  name: 'Geom',
                },
                {
                  value: 3,
                  name: 'Shape',
                },
                {
                  value: 3,
                  name: 'Scale',
                },
                {
                  value: 3,
                  name: 'Animate',
                },
                {
                  value: 3,
                  name: 'Global',
                },
                {
                  value: 3,
                  name: 'Slider',
                },
                {
                  value: 3,
                  name: 'Connector',
                },
                {
                  value: 3,
                  name: 'Transform',
                },
                {
                  value: 3,
                  name: 'Util',
                },
                {
                  value: 3,
                  name: 'DomUtil',
                },
                {
                  value: 3,
                  name: 'MatrixUtil',
                },
                {
                  value: 3,
                  name: 'PathUtil',
                },
                {
                  value: 3,
                  name: 'G',
                },
                {
                  value: 3,
                  name: '2D',
                },
                {
                  value: 3,
                  name: '3D',
                },
                {
                  value: 3,
                  name: 'Line',
                },
                {
                  value: 3,
                  name: 'Area',
                },
                {
                  value: 3,
                  name: 'Interval',
                },
                {
                  value: 3,
                  name: 'Schema',
                },
                {
                  value: 3,
                  name: 'Edge',
                },
                {
                  value: 3,
                  name: 'Polygon',
                },
                {
                  value: 3,
                  name: 'Heatmap',
                },
                {
                  value: 3,
                  name: 'Render',
                },
                {
                  value: 3,
                  name: 'Tooltip',
                },
                {
                  value: 3,
                  name: 'Axis',
                },
                {
                  value: 3,
                  name: 'Guide',
                },
                {
                  value: 3,
                  name: 'Coord',
                },
                {
                  value: 3,
                  name: 'Legend',
                },
                {
                  value: 3,
                  name: 'Path',
                },
                {
                  value: 3,
                  name: 'Helix',
                },
                {
                  value: 3,
                  name: 'Theta',
                },
                {
                  value: 3,
                  name: 'Rect',
                },
                {
                  value: 3,
                  name: 'Polar',
                },
                {
                  value: 3,
                  name: 'Dsv',
                },
                {
                  value: 3,
                  name: 'Csv',
                },
                {
                  value: 3,
                  name: 'Tsv',
                },
                {
                  value: 3,
                  name: 'GeoJSON',
                },
                {
                  value: 3,
                  name: 'TopoJSON',
                },
                {
                  value: 3,
                  name: 'Filter',
                },
                {
                  value: 3,
                  name: 'Map',
                },
                {
                  value: 3,
                  name: 'Pick',
                },
                {
                  value: 3,
                  name: 'Rename',
                },
                {
                  value: 3,
                  name: 'Filter',
                },
                {
                  value: 3,
                  name: 'Map',
                },
                {
                  value: 3,
                  name: 'Pick',
                },
                {
                  value: 3,
                  name: 'Rename',
                },
                {
                  value: 3,
                  name: 'Reverse',
                },
                {
                  value: 3,
                  name: 'sort',
                },
                {
                  value: 3,
                  name: 'Subset',
                },
                {
                  value: 3,
                  name: 'Partition',
                },
                {
                  value: 3,
                  name: 'Imputation',
                },
                {
                  value: 3,
                  name: 'Fold',
                },
                {
                  value: 3,
                  name: 'Aggregate',
                },
                {
                  value: 3,
                  name: 'Proportion',
                },
                {
                  value: 3,
                  name: 'Histogram',
                },
                {
                  value: 3,
                  name: 'Quantile',
                },
                {
                  value: 3,
                  name: 'Treemap',
                },
                {
                  value: 3,
                  name: 'Hexagon',
                },
                {
                  value: 3,
                  name: 'Binning',
                },
                {
                  value: 3,
                  name: 'kernel',
                },
                {
                  value: 3,
                  name: 'Regression',
                },
                {
                  value: 3,
                  name: 'Density',
                },
                {
                  value: 3,
                  name: 'Sankey',
                },
                {
                  value: 3,
                  name: 'Voronoi',
                },
                {
                  value: 3,
                  name: 'Projection',
                },
                {
                  value: 3,
                  name: 'Centroid',
                },
                {
                  value: 3,
                  name: 'H5',
                },
                {
                  value: 3,
                  name: 'Mobile',
                },
                {
                  value: 3,
                  name: 'K线图',
                },
                {
                  value: 3,
                  name: '关系图',
                },
                {
                  value: 3,
                  name: '烛形图',
                },
                {
                  value: 3,
                  name: '股票图',
                },
                {
                  value: 3,
                  name: '直方图',
                },
                {
                  value: 3,
                  name: '金字塔图',
                },
                {
                  value: 3,
                  name: '分面',
                },
                {
                  value: 3,
                  name: '南丁格尔玫瑰图',
                },
                {
                  value: 3,
                  name: '饼图',
                },
                {
                  value: 3,
                  name: '线图',
                },
                {
                  value: 3,
                  name: '点图',
                },
                {
                  value: 3,
                  name: '散点图',
                },
                {
                  value: 3,
                  name: '子弹图',
                },
                {
                  value: 3,
                  name: '柱状图',
                },
                {
                  value: 3,
                  name: '仪表盘',
                },
                {
                  value: 3,
                  name: '气泡图',
                },
                {
                  value: 3,
                  name: '漏斗图',
                },
                {
                  value: 3,
                  name: '热力图',
                },
                {
                  value: 3,
                  name: '玉玦图',
                },
                {
                  value: 3,
                  name: '直方图',
                },
                {
                  value: 3,
                  name: '矩形树图',
                },
                {
                  value: 3,
                  name: '箱形图',
                },
                {
                  value: 3,
                  name: '色块图',
                },
                {
                  value: 3,
                  name: '螺旋图',
                },
                {
                  value: 3,
                  name: '词云',
                },
                {
                  value: 3,
                  name: '词云图',
                },
                {
                  value: 3,
                  name: '雷达图',
                },
                {
                  value: 3,
                  name: '面积图',
                },
                {
                  value: 3,
                  name: '马赛克图',
                },
                {
                  value: 3,
                  name: '盒须图',
                },
                {
                  value: 3,
                  name: '坐标轴',
                },
                {
                  value: 3,
                  name: '',
                },
                {
                  value: 3,
                  name: 'Jacques Bertin',
                },
                {
                  value: 3,
                  name: 'Leland Wilkinson',
                },
                {
                  value: 3,
                  name: 'William Playfair',
                },
                {
                  value: 3,
                  name: '关联',
                },
                {
                  value: 3,
                  name: '分布',
                },
                {
                  value: 3,
                  name: '区间',
                },
                {
                  value: 3,
                  name: '占比',
                },
                {
                  value: 3,
                  name: '地图',
                },
                {
                  value: 3,
                  name: '时间',
                },
                {
                  value: 3,
                  name: '比较',
                },
                {
                  value: 3,
                  name: '流程',
                },
                {
                  value: 3,
                  name: '趋势',
                },
                {
                  value: 2,
                  name: '亦叶',
                },
                {
                  value: 2,
                  name: '再飞',
                },
                {
                  value: 2,
                  name: '完白',
                },
                {
                  value: 2,
                  name: '巴思',
                },
                {
                  value: 2,
                  name: '张初尘',
                },
                {
                  value: 2,
                  name: '御术',
                },
                {
                  value: 2,
                  name: '有田',
                },
                {
                  value: 2,
                  name: '沉鱼',
                },
                {
                  value: 2,
                  name: '玉伯',
                },
                {
                  value: 2,
                  name: '画康',
                },
                {
                  value: 2,
                  name: '祯逸',
                },
                {
                  value: 2,
                  name: '绝云',
                },
                {
                  value: 2,
                  name: '罗宪',
                },
                {
                  value: 2,
                  name: '萧庆',
                },
                {
                  value: 2,
                  name: '董珊珊',
                },
                {
                  value: 2,
                  name: '陆沉',
                },
                {
                  value: 2,
                  name: '顾倾',
                },
                {
                  value: 2,
                  name: 'Domo',
                },
                {
                  value: 2,
                  name: 'GPL',
                },
                {
                  value: 2,
                  name: 'PAI',
                },
                {
                  value: 2,
                  name: 'SPSS',
                },
                {
                  value: 2,
                  name: 'SYSTAT',
                },
                {
                  value: 2,
                  name: 'Tableau',
                },
                {
                  value: 2,
                  name: 'D3',
                },
                {
                  value: 2,
                  name: 'Vega',
                },
                {
                  value: 2,
                  name: '统计图表',
                },
              ],
              option: {
                fontFamily: 'SimSun',
                color: '#FFE472',
                minSize: 8,
                maxSize: 32,
                padding: 8,
                customColor: [],
                series: [
                  {
                    shape: 'circle',
                  },
                ],
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
          {
            id: '1011137154469872896',
            parentId: '300000200',
            name: '图层字符云',
            compType: 'JImgWordCloud',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  value: 9,
                  name: 'AntV',
                },
                {
                  value: 8,
                  name: 'F2',
                },
                {
                  value: 8,
                  name: 'G2',
                },
                {
                  value: 8,
                  name: 'G6',
                },
                {
                  value: 8,
                  name: 'DataSet',
                },
                {
                  value: 8,
                  name: '墨者学院',
                },
                {
                  value: 6,
                  name: 'Analysis',
                },
                {
                  value: 6,
                  name: 'Data Mining',
                },
                {
                  value: 6,
                  name: 'Data Vis',
                },
                {
                  value: 6,
                  name: 'Design',
                },
                {
                  value: 6,
                  name: 'Grammar',
                },
                {
                  value: 6,
                  name: 'Graphics',
                },
                {
                  value: 6,
                  name: 'Graph',
                },
                {
                  value: 6,
                  name: 'Hierarchy',
                },
                {
                  value: 6,
                  name: 'Labeling',
                },
                {
                  value: 6,
                  name: 'Layout',
                },
                {
                  value: 6,
                  name: 'Quantitative',
                },
                {
                  value: 6,
                  name: 'Relation',
                },
                {
                  value: 6,
                  name: 'Statistics',
                },
                {
                  value: 6,
                  name: '可视化',
                },
                {
                  value: 6,
                  name: '数据',
                },
                {
                  value: 6,
                  name: '数据可视化',
                },
                {
                  value: 4,
                  name: 'Arc Diagram',
                },
                {
                  value: 4,
                  name: 'Bar Chart',
                },
                {
                  value: 4,
                  name: 'Canvas',
                },
                {
                  value: 4,
                  name: 'Chart',
                },
                {
                  value: 4,
                  name: 'DAG',
                },
                {
                  value: 4,
                  name: 'DG',
                },
                {
                  value: 4,
                  name: 'Facet',
                },
                {
                  value: 4,
                  name: 'Geo',
                },
                {
                  value: 4,
                  name: 'Line',
                },
                {
                  value: 4,
                  name: 'MindMap',
                },
                {
                  value: 4,
                  name: 'Pie',
                },
                {
                  value: 4,
                  name: 'Pizza Chart',
                },
                {
                  value: 4,
                  name: 'Punch Card',
                },
                {
                  value: 4,
                  name: 'SVG',
                },
                {
                  value: 4,
                  name: 'Sunburst',
                },
                {
                  value: 4,
                  name: 'Tree',
                },
                {
                  value: 4,
                  name: 'UML',
                },
                {
                  value: 3,
                  name: 'Chart',
                },
                {
                  value: 3,
                  name: 'View',
                },
                {
                  value: 3,
                  name: 'Geom',
                },
                {
                  value: 3,
                  name: 'Shape',
                },
                {
                  value: 3,
                  name: 'Scale',
                },
                {
                  value: 3,
                  name: 'Animate',
                },
                {
                  value: 3,
                  name: 'Global',
                },
                {
                  value: 3,
                  name: 'Slider',
                },
                {
                  value: 3,
                  name: 'Connector',
                },
                {
                  value: 3,
                  name: 'Transform',
                },
                {
                  value: 3,
                  name: 'Util',
                },
                {
                  value: 3,
                  name: 'DomUtil',
                },
                {
                  value: 3,
                  name: 'MatrixUtil',
                },
                {
                  value: 3,
                  name: 'PathUtil',
                },
                {
                  value: 3,
                  name: 'G',
                },
                {
                  value: 3,
                  name: '2D',
                },
                {
                  value: 3,
                  name: '3D',
                },
                {
                  value: 3,
                  name: 'Line',
                },
                {
                  value: 3,
                  name: 'Area',
                },
                {
                  value: 3,
                  name: 'Interval',
                },
                {
                  value: 3,
                  name: 'Schema',
                },
                {
                  value: 3,
                  name: 'Edge',
                },
                {
                  value: 3,
                  name: 'Polygon',
                },
                {
                  value: 3,
                  name: 'Heatmap',
                },
                {
                  value: 3,
                  name: 'Render',
                },
                {
                  value: 3,
                  name: 'Tooltip',
                },
                {
                  value: 3,
                  name: 'Axis',
                },
                {
                  value: 3,
                  name: 'Guide',
                },
                {
                  value: 3,
                  name: 'Coord',
                },
                {
                  value: 3,
                  name: 'Legend',
                },
                {
                  value: 3,
                  name: 'Path',
                },
                {
                  value: 3,
                  name: 'Helix',
                },
                {
                  value: 3,
                  name: 'Theta',
                },
                {
                  value: 3,
                  name: 'Rect',
                },
                {
                  value: 3,
                  name: 'Polar',
                },
                {
                  value: 3,
                  name: 'Dsv',
                },
                {
                  value: 3,
                  name: 'Csv',
                },
                {
                  value: 3,
                  name: 'Tsv',
                },
                {
                  value: 3,
                  name: 'GeoJSON',
                },
                {
                  value: 3,
                  name: 'TopoJSON',
                },
                {
                  value: 3,
                  name: 'Filter',
                },
                {
                  value: 3,
                  name: 'Map',
                },
                {
                  value: 3,
                  name: 'Pick',
                },
                {
                  value: 3,
                  name: 'Rename',
                },
                {
                  value: 3,
                  name: 'Filter',
                },
                {
                  value: 3,
                  name: 'Map',
                },
                {
                  value: 3,
                  name: 'Pick',
                },
                {
                  value: 3,
                  name: 'Rename',
                },
                {
                  value: 3,
                  name: 'Reverse',
                },
                {
                  value: 3,
                  name: 'sort',
                },
                {
                  value: 3,
                  name: 'Subset',
                },
                {
                  value: 3,
                  name: 'Partition',
                },
                {
                  value: 3,
                  name: 'Imputation',
                },
                {
                  value: 3,
                  name: 'Fold',
                },
                {
                  value: 3,
                  name: 'Aggregate',
                },
                {
                  value: 3,
                  name: 'Proportion',
                },
                {
                  value: 3,
                  name: 'Histogram',
                },
                {
                  value: 3,
                  name: 'Quantile',
                },
                {
                  value: 3,
                  name: 'Treemap',
                },
                {
                  value: 3,
                  name: 'Hexagon',
                },
                {
                  value: 3,
                  name: 'Binning',
                },
                {
                  value: 3,
                  name: 'kernel',
                },
                {
                  value: 3,
                  name: 'Regression',
                },
                {
                  value: 3,
                  name: 'Density',
                },
                {
                  value: 3,
                  name: 'Sankey',
                },
                {
                  value: 3,
                  name: 'Voronoi',
                },
                {
                  value: 3,
                  name: 'Projection',
                },
                {
                  value: 3,
                  name: 'Centroid',
                },
                {
                  value: 3,
                  name: 'H5',
                },
                {
                  value: 3,
                  name: 'Mobile',
                },
                {
                  value: 3,
                  name: 'K线图',
                },
                {
                  value: 3,
                  name: '关系图',
                },
                {
                  value: 3,
                  name: '烛形图',
                },
                {
                  value: 3,
                  name: '股票图',
                },
                {
                  value: 3,
                  name: '直方图',
                },
                {
                  value: 3,
                  name: '金字塔图',
                },
                {
                  value: 3,
                  name: '分面',
                },
                {
                  value: 3,
                  name: '南丁格尔玫瑰图',
                },
                {
                  value: 3,
                  name: '饼图',
                },
                {
                  value: 3,
                  name: '线图',
                },
                {
                  value: 3,
                  name: '点图',
                },
                {
                  value: 3,
                  name: '散点图',
                },
                {
                  value: 3,
                  name: '子弹图',
                },
                {
                  value: 3,
                  name: '柱状图',
                },
                {
                  value: 3,
                  name: '仪表盘',
                },
                {
                  value: 3,
                  name: '气泡图',
                },
                {
                  value: 3,
                  name: '漏斗图',
                },
                {
                  value: 3,
                  name: '热力图',
                },
                {
                  value: 3,
                  name: '玉玦图',
                },
                {
                  value: 3,
                  name: '直方图',
                },
                {
                  value: 3,
                  name: '矩形树图',
                },
                {
                  value: 3,
                  name: '箱形图',
                },
                {
                  value: 3,
                  name: '色块图',
                },
                {
                  value: 3,
                  name: '螺旋图',
                },
                {
                  value: 3,
                  name: '词云',
                },
                {
                  value: 3,
                  name: '词云图',
                },
                {
                  value: 3,
                  name: '雷达图',
                },
                {
                  value: 3,
                  name: '面积图',
                },
                {
                  value: 3,
                  name: '马赛克图',
                },
                {
                  value: 3,
                  name: '盒须图',
                },
                {
                  value: 3,
                  name: '坐标轴',
                },
                {
                  value: 3,
                  name: '',
                },
                {
                  value: 3,
                  name: 'Jacques Bertin',
                },
                {
                  value: 3,
                  name: 'Leland Wilkinson',
                },
                {
                  value: 3,
                  name: 'William Playfair',
                },
                {
                  value: 3,
                  name: '关联',
                },
                {
                  value: 3,
                  name: '分布',
                },
                {
                  value: 3,
                  name: '区间',
                },
                {
                  value: 3,
                  name: '占比',
                },
                {
                  value: 3,
                  name: '地图',
                },
                {
                  value: 3,
                  name: '时间',
                },
                {
                  value: 3,
                  name: '比较',
                },
                {
                  value: 3,
                  name: '流程',
                },
                {
                  value: 3,
                  name: '趋势',
                },
                {
                  value: 2,
                  name: '亦叶',
                },
                {
                  value: 2,
                  name: '再飞',
                },
                {
                  value: 2,
                  name: '完白',
                },
                {
                  value: 2,
                  name: '巴思',
                },
                {
                  value: 2,
                  name: '张初尘',
                },
                {
                  value: 2,
                  name: '御术',
                },
                {
                  value: 2,
                  name: '有田',
                },
                {
                  value: 2,
                  name: '沉鱼',
                },
                {
                  value: 2,
                  name: '玉伯',
                },
                {
                  value: 2,
                  name: '画康',
                },
                {
                  value: 2,
                  name: '祯逸',
                },
                {
                  value: 2,
                  name: '绝云',
                },
                {
                  value: 2,
                  name: '罗宪',
                },
                {
                  value: 2,
                  name: '萧庆',
                },
                {
                  value: 2,
                  name: '董珊珊',
                },
                {
                  value: 2,
                  name: '陆沉',
                },
                {
                  value: 2,
                  name: '顾倾',
                },
                {
                  value: 2,
                  name: 'Domo',
                },
                {
                  value: 2,
                  name: 'GPL',
                },
                {
                  value: 2,
                  name: 'PAI',
                },
                {
                  value: 2,
                  name: 'SPSS',
                },
                {
                  value: 2,
                  name: 'SYSTAT',
                },
                {
                  value: 2,
                  name: 'Tableau',
                },
                {
                  value: 2,
                  name: 'D3',
                },
                {
                  value: 2,
                  name: 'Vega',
                },
                {
                  value: 2,
                  name: '统计图表',
                },
              ],
              option: {
                fontFamily: 'SimSun',
                color: '#FFE472',
                minFontSize: 8,
                maxFontSize: 32,
                padding: 1,
                rotation: 0,
                imageMask:
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXcAAABJCAIAAABJpfHAAAAOCUlEQVR4Ae2ddYwUyxbGH+43uLu7EwiwC0GCa3AIkuBBEyBIAkECu4HggeAW3C4OISEQHk5wCe7uwQnyfrDvzl1m2emanu5pO/3P9HSfOnXqq+6vS86pSvDjx4//yCEICAKCgGkIJDRNsygWBAQBQeAnAsIy8hwIAoKAuQgIy5iLr2gXBAQBYRl5BgQBQcBcBIRlzMVXtAsCgoCwjDwDgoAgYC4Cic1VL9oFAdMQ+Pr165MnTy5fvnzhwoVz5869ePHixo0b9+7di51hpUqV0qRJky1btqJFixYpUiRv3ry5c+dOkSJFbBmzz798+fLo0SMsvHr16sWLF/9oZ6FChXLlypUyZcoyZcpkzZq1cOHCBQsWTJ8+fcKEbmgHJPCsv8y6det69OgR+Anr1q3bpEmT9D2UHz9+HDFixJIlSwJnofuuPtvsaVVQIFCEkydPbtu2befOnX6coqinevXqdevWbdCgAe+2Sa8xr9XTp0937dqFnUePHn337p2ibbHF0qVLV6NGjZo1a9apUydHjhwmmRo7R5POpS1jErCi1ngE7t+/v2rVquXLl+sjF59B//11jBkzZsGCBW3atPFdN+QEEkT9woULd+/eHaLCV69e/f3rQE+JEiWioqIiIyND1GlJcmEZS2CXTIND4Pnz57NmzeLV1dcoCC4zvdKfP3+m5TJ16lS6RXp1xJsOnY8fP473tr1vCMvYu348bx2v7tatW6Ojo69du2ZbMOgfMewyceLE0Nsvti1jKIYJy4SCnqQ1FwEGd0ePHr1mzRpzswlN+4cPH2bPnj1jxgw7t7NCK2KoqYVlQkVQ0puEwNmzZ4cNG8bQqUn6DVHLCBFj/HSUDNHmViXCMm6tWQeXiw4IA6iDBw+2cy8JfJlEHzRokM150A7PgbCMHWpBbPgNgUOHDvXp0yfEiaTfNJrw59KlS/3792dO3QTdblPpBp8ft9WJt8sDxdBAsDnFXLlyRShG/TmVtow6ViJpOgI47zLcq6+jlDp16tKlS+fLlw9fO5+hqLp79y7Owfie+C6GeIK73dixY3W0YmK87CpWrFiyZElcPfPnz584ceIHDx68fv0ak27dunXnzp3Tp0+fOnXKQGtDLKwhyYVlDIFRvxIzHMP0W/NPSkusYrJmzpw5wb69OOZ37ty5cePGuOQnTZr0nxL89stAD+/tmTNncBfesGFDKO8wM+szZ87csWPHbxlo/WnVqlX37t0rVKgQ10LCCGJSR0RExJx8//6dyTVGpvDI279/vwumroRltB4QuR8WBCACZmrwu1PPjTbL0KFDmzZtqhkCkiBBAl7mWr+O8ePH79mzZ968eYcPH1bPyye5ffv2oKJG6tevP3LkSBpZ2OBTEviESAICr1r/Ot6+fYsPDuRLAydwKjvfFZaxc+14yLabN2/Onz9fvcADBgwYOHBgxowZ1ZPESEJJzZs3J4iJZsK3b9+CSk7nCyMVGxf04Oj9de3aNVmyZEHlEluYUE/YBibVYW1sPdaeC8tYi7/k/hMBoqtXrlyp2Ffi7SWEtUOHDgxq6IaPN79evXpBJYeS6G0pzlvTj5s2bRpRjupNmADG6LA2gLbw39JfT+G3VXJ0KwKM0dITUSkdFDN9+nSGOQx5e1Vy9MmwboOiF7KxFOMzwLknMpPt3LpzieW0ETZt2sTcsEp5hgwZ0qJFi/BTDEayjIOKkfAg0d5GtWJUMLG/jLCM/evI5RY+fPjwwIEDKoXs0qVLr169QukoqeTyRxmMVIyEbNeuXaNGjcLPg3802yYXhWVsUhHeNeP8+fPHjh3TLD8r3fXs2ZPV5DQlzRDAjUXRSFYXs8pIMwpuiE5hGUNgFCU6EWC1ShxDVBI3a9asWLFiKpKGy2Ck4qAvDRmrjDS81AYqFJYxEExRFTQCLIJL7LVmMhoyLVu2TJQokaakGQLqRjJBbpWRZhTcKJ3CMkYhKXr0IMAim7jkaqbEKz9PnjyaYiYJ4PhvfyNNKrshaoVlDIFRlOhE4Pr16ypObmxFYOFgBys82N9InRUQlmTiLxMWmOPPhH0UNLdSiJva7Dij8FhFVMHt27fjls7vCnPDhBf6XQzbX+awcfnVzM5aIzXNs1ZA2jLW4u/p3D99+kRYoCYELN/PFkWaYiYJEB7J2uaayq01UtM8awWkLWMt/p7OnU1FVJoJadOmJZzHKqSgQhZn0MxdxUhcnAlrYhkKTW0BBGrXrk1MqS+SO4CkfW5JW8Y+deE5S1jigP6IZrGzZ88eSsChpv7AArRlOALLcNdaIzXNs1ZAWMZa/D2dO+u8qHRGrMWIcd+YVaasNcPRuQvLOLr6xHhBwAEICMs4oJLEREHA0QgIyzi6+sR4QcABCAjLOKCSPG4iI8R41ngcBEcXX1jG0dXnbOOTJ0+eKlUqzTIwkcx0sqaYSQK42zFLramcKXkm5jXFvCkg/jIW17vZXrz6ihceq6AY3mFNCx8/fsxUlFUeIkyiq8yjE1HJVJRVRmpiaK2AsIy1+Hs6d7YNyZQpkyYEFy9epDlTuHBhTUkzBFiNPHfu3JqaCchinya2WAogmSRJEvZdyJw5c3wy7Fhw4sSJ+O4697qwjHPrzvGWwzIZMmRQKQa7mkRGRlqyqALduixZsmgaiVsNQZVVqlQJIJk3b96lS5cGEGAVm2DXPA+gzT63ZFzGPnXhOUtgmdj7QAYo//Hjx589exZAwLxbrK0JO6jopxnCxnUqkl6T8S7LqEQD8/GUBVxNfSUU+0HsRgTRmGpJAOXsWqkyfkRLhF2lAujx7C2PsoxiNDBNZRrMnn04wlBwhjwqV66sktG6deus8vTPmTNn2bJlNY1kk+8tW7aoRGZpqnKZgEdZ5v379yptGZWxSZc9EGEuDptDFi9eXCVT9rflHbbEcYbBozJlyqgYiYWMzqhIekrGoyxz7949lQB8xQ65p54YYwvLDE7VqlUVdU6ePPnQoUOKwgaKMX5UvXp1FYVs2MQWtzI644eVF1mG7yHr5uOF4YeF398CBQpIW8YPEzP+0mNiWV8VzXwb2FBNZes1FW1ByZQvX75mzZoqSZYtWzZv3jz25FUR9oiMF1mGh5Xmt2YFsw+phUu0aZrnGgFGPWrVqqVYHPbSHj58OJvJKsobJcYIXd26dRW1TZkyZdWqVUI0Prg8xzLU/dq1a1W212GNxb/++suHlJyYhAATeQ0bNoTTFfXv27evQ4cOe/bsYREsxSRxxYgGWL9+veLm3CRnqrFJkyaKbS58Z0aMGDFt2jSJOYhB3j0swwTE3LlzA6+KBMUsXryY7dzjPnZxr9AVp0Me97pcMRyBUqVKtWnTRl0tS1si37dvX4bwgxoPRpiVhhk6YV3L7t27BzWAwnRYq1atFI2EaCZMmMD6m+w2FZSFivqdJeYeluHLtnfv3vr169Mr5knyq1r+8kT269dv6NChPAGalcRXi7aMppgIGIIAW1937NhRsaXgy3H16tXVqlXr1KnTzp07X7586VfjPjFOaFMwmrNo0SI2qMRDh2eAqIXYAirnNGdat25Ni0ZFOEaGrbVppvXp0+fIkSNsUBk4IZR369atwDIOveu2CAO+csN+HaVLl8avFKZImDAhF9mM+dy5c+qVxEgB4wXq8rol9e1JEpOdeQtNh98qIoB69+49aNAglW+AD22E6fVwcIU+FwP2TDmnS5cuRoB6f/ToEcNwnPiShHLCvDtGsgMcOhX1YCFsyIFVNWrUKFeuHFvcxt5bCnJhupMQCnrxQZVd0QA7iLmNZXyYwikcGzdu9F1RP2G/VD56lkTNqBvpMklaCk2bNqV/MWvWLH1F483nwEtYX3LFVLSemOcKlg1RziLHf/86FDNyk5h7ekwG1orsqW4gmOqqWGBhwIABjRo1Uk8SfknYsEWLFkOGDAl/1s7NUVjGv+4IimWMQBoy/riE5T+rIjA2b3OiYRSJfhOzSGGBxA2ZCMv8Vov07fmcqkT6/5ZM/hiHAESDv0nz5s2NU2m8JlyWBw8ePHbsWJUoSuOzd5pGYZl/a4wnhi43He9/L8mZFQiwgxotGmaarchcNc+Y/t2cOXMUF69Q1etGOWGZ/9cqrRjcbXCIoOPtxop2WJmYkYmOjmbu2c7vMNOXzBJs2rSpffv24cGXD2GFChVoSYUnO6NyEZb5iSRLnK1YsQJXCKEYox6s0PUw/AHpMy1DH9bOHRO89WjREI2tHvapAxwQ6NmzJ8GiI0eOFJbRAaCVSfhmTpw4cfPmzTgyCMVYWRPx5I3X0rhx43i78G3zOcLEIxvEZRyppk6d2qBBgyDSxC9Ko4ZYSoLjtm7dil9o/IJ67kBeM2bMwEmHkHQWCXDiU+oefxn6ySw1RBwdThMqlYmnadu2bflayrrzKnBZKMN7xdsVFRU1atSogwcPEoZ24MAB3E90mETUCEGPkAsdMahBh4YASWh84XfH+sQsM75r1y5IR7ejHf33iIiIOnXqYDDD4U5klthAJQjglx1bzinn+HHjpn3s2DEqmBMc83z+lHgDZ8uWjZAZerYcLqg8p1SK4XZSyzj1UrksGYUj35s3b3Cf9eOdSpUqpUmThhovWrQobpbwFF2bMPc1Yp5GvnwcxDSwmwrr6fl9BeE7OAVvYLyWWQOgZMmSmMoOUIaToOG1oK7QbSyjXnKRFAQEgfAgYHCjMTxGSy6CgCDgIASEZRxUWWKqIOBIBIRlHFltYrQg4CAEhGUcVFliqiDgSASEZRxZbWK0IOAgBIRlHFRZYqog4EgEhGUcWW1itCDgIASEZRxUWWKqIOBIBP4HW84gCf5RZvwAAAAASUVORK5CYII=',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
          {
            id: '1011125694469872896',
            parentId: '300000200',
            name: '闪动字符云',
            compType: 'JFlashCloud',
            compConfig: {
              w: 350,
              h: 390,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '小米手机',
                  value: 12550,
                },
                {
                  name: '天猫',
                  value: 1234,
                },
                {
                  name: 'iPhone X',
                  value: 19651,
                },
                {
                  name: '华为P20',
                  value: 17319,
                },
                {
                  name: 'Mac Pro',
                  value: 18341,
                },
              ],
              option: {
                zoom: 1,
                textColor: '#fff',
                textSize: 14,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '300000300',
        parentId: '300000',
        name: '天气预报',
        compType: 'weather',
        compConfig: null,
        icon: 'JWeatherForecast',
        children: [
          {
            id: '100972801',
            parentId: '300000300',
            name: '滚动版',
            compType: 'JWeatherForecast',
            compConfig: {
              w: 311,
              h: 47,
              dataType: 1,
              option: {
                city: '',
                template: 11,
                num: 2,
                fontSize: 16,
                fontColor: '#fff',
                bgColor: '#ffffff00',
                url: '',
              },
            },
            icon: '',
          },
          {
            id: '100972802',
            parentId: '300000300',
            name: '横线版',
            compType: 'JWeatherForecast',
            compConfig: {
              w: 300,
              h: 30,
              dataType: 1,
              option: {
                city: '',
                template: 34,
                num: 2,
                fontSize: 16,
                fontColor: '#fff',
                bgColor: '#ffffff00',
                url: '',
              },
            },
            icon: '',
          },
          {
            id: '100972803',
            parentId: '300000300',
            name: '带背景',
            compType: 'JWeatherForecast',
            compConfig: {
              w: 415,
              h: 131,
              dataType: 1,
              option: {
                city: '',
                template: 21,
                num: 2,
                fontSize: 16,
                fontColor: '#000',
                bgColor: '#ffffff00',
                url: '',
              },
            },
            icon: '',
          },
          {
            id: '100972804',
            parentId: '300000300',
            name: '好123版',
            compType: 'JWeatherForecast',
            compConfig: {
              w: 318,
              h: 61,
              dataType: 1,
              option: {
                city: '',
                template: 12,
                num: 2,
                fontSize: 16,
                fontColor: '#fff',
                bgColor: '#ffffff00',
                url: '',
              },
            },
            icon: '',
          },
          {
            id: '100972805',
            parentId: '300000300',
            name: '温度计版',
            compType: 'JWeatherForecast',
            compConfig: {
              w: 400,
              h: 266,
              dataType: 1,
              option: {
                city: '',
                template: 27,
                num: 2,
                fontSize: 16,
                fontColor: '#fff',
                bgColor: '#ffffff',
                url: '',
              },
            },
            icon: '',
          },
          {
            id: '100972806',
            parentId: '300000300',
            name: '列表文字版',
            compType: 'JWeatherForecast',
            compConfig: {
              w: 257,
              h: 47,
              dataType: 1,
              option: {
                city: '',
                template: 94,
                num: 2,
                fontSize: 16,
                fontColor: '#fff',
                bgColor: '#ffffff00',
                url: '',
              },
            },
            icon: '',
          },
        ],
      },
    ],
  },
  {
    id: '400000',
    show: true,
    parentId: '200',
    name: '表格',
    compType: 'bar',
    compConfig: null,
    icon: 'JCommonTable',
    children: [
      {
        id: '400000300',
        parentId: '400000',
        name: '轮播表格',
        compType: 'bar',
        compConfig: null,
        icon: 'JScrollBoard',
        children: [
          {
            id: '1009694340236869632',
            parentId: '400000300',
            name: '轮播表',
            compType: 'JScrollBoard',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              chartData: [
                ['行1列1', '行1列2', '行1列3'],
                ['行2列1', '行2列2', '行2列3'],
                ['行3列1', '行3列2', '行3列3'],
                ['行4列1', '行4列2', '行4列3'],
                ['行5列1', '行5列2', '行5列3'],
              ],
              option: {
                index: true,
                headShow: true,
                header: [
                  { label: '列1', key: '', width: 100 },
                  { label: '列2', key: '', width: 100 },
                  { label: '列3', key: '', width: 100 },
                ],
                headerBGC: '#00BAFF',
                headerHeight: 35,
                waitTime: 2000,
                rowNum: 5,
                carousel: 'single',
                hoverPause: true,
                indexWidth: 80,
                oddRowBGC: '#003B51',
                evenRowBGC: '#0A2732',
                headFontSize: 14,
                bodyFontSize: 12,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
          {
            id: '10096943158236869632',
            parentId: '400000300',
            name: '表格',
            compType: 'JScrollTable',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              syncColumn: false,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              chartData: [
                {
                  name: '张三',
                  age: 18,
                  gender: '男',
                },
                {
                  name: '李四',
                  age: 20,
                  gender: '女',
                },
                {
                  name: '王五',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '赵六',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '王思聪',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '王健林',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '马云',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '马化腾',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '马1',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '马2',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '马3',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '马4',
                  age: 22,
                  gender: '男',
                },
                {
                  name: '马5',
                  age: 22,
                  gender: '男',
                },
              ],
              option: {
                ranking: false,
                rankingTitle: '#',
                textPosition: 'center',
                lineHeight: 50,
                fontSize: 24,
                bodyFontSize: 24,
                scrollTime: 50,
                scroll: false,
                showBorder: false,
                borderWidth: 1,
                borderColor: '#fff',
                borderStyle: 'solid',
                showHead: true,
                bodyFontColor: '#fff',
                oddColor: '#0a2732',
                evenColor: '#003b51',
                headerBgColor: '#0a73ff',
                headerFontColor: '#ffffff',
                fieldMapping: [
                  { name: '名称', key: 'name', width: 0 },
                  { name: '年龄', key: 'age', width: 0 },
                  { name: '性别', key: 'gender', width: 0 },
                ],
              },
            },
            icon: null,
          },
          {
            id: '1011136904469872896',
            parentId: '400000300',
            name: '发展历程',
            compType: 'JDevHistory',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'https://api.jeecg.com/mock/26/history',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '年份',
                  mapping: '',
                },
                {
                  filed: '标题',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  year: '2012',
                  title: '开源项目JEECG被"CSDN专家访谈"',
                },
                {
                  year: '2012',
                  title: '开源项目JEECG被"ITeye专家访谈',
                },
                {
                  year: '2012',
                  title: 'JEECG在Google Code上开源',
                },
                {
                  year: '2012',
                  title: '推出开源项目"MiniDao(持久层解决方案）"超越了Mybatis和 Hibernate',
                },
                {
                  year: '2013',
                  title: '应邀参加了"SDCC 2013中国软件开发者大会" （大会由CSDN和《程 序员》杂志倾力打造）',
                },
                {
                  year: '2012',
                  title: 'JEECG参加“云计算成就创业梦想”第二届阿里云开发者大赛"园',
                },
                {
                  year: '2013',
                  title: '2017.07，开发GBI区块链资讯信息平台',
                },
                {
                  year: '2013',
                  title: '成立JEECG开源团队，创立JEECG开源社区',
                },
                {
                  year: '2013',
                  title: '中国优秀开源项目评选-公开投票,“JEECG以887票位居第九',
                },
                {
                  year: '2013',
                  title: '2013年应邀参加"开源群英会2013”的开源英雄',
                },
                {
                  year: '2014',
                  title: '12月份捷微jeewx与联通集团达成战略合作，负责联通集团微信公众 账号集团化运营',
                },
                {
                  year: '2014',
                  title: '8月份捷微jeewx2.0与百度达成战略合作，集成百度地图，增加地图 功能，附近商家团购等信息搜索',
                },
                {
                  year: '2014',
                  title: '推出当前最火的开源项目“JeeWx(捷微:敏捷微信开发平台）”，并 获得CSDN举办的“2014年开发者大会”公开投票第一名',
                },
                {
                  year: '2014',
                  title: '5月应邀参加中国科学院大学创新创业年度论坛，探讨“创业企业发 展、创新创业孵化”的主题',
                },
                {
                  year: '2015',
                  title: '推出微信H5活动营销平台，专业解决客户对H5互动活动需求（H5huo dong.com）',
                },
                {
                  year: '2015',
                  title: '开源中国最热开源项目TOP20，社区开源项目独占4份，前五名两位（ jeewx、jeecg）',
                },
                {
                  year: '2015',
                  title: '12月独创，微信插件开发机制（java）,推出H5活动平台（www.h5h uodong.com），致力于互动微信H5活动开发',
                },
                {
                  year: '2015',
                  title: '6月份捷微jeewx推出集企业号版本，与中国移动打成战略合作，推出 企业号营销新模式',
                },
                {
                  year: '2015',
                  title: '3月份捷微jeewx推出集团化微信运营版本，专注微信应用一体化，企 业系统集成，实现公众账号上下级，类似组织机构权限模式',
                },
                {
                  year: '2016',
                  title: 'jeecg推出插件开发机制 jeecg-p3，主推通过jeecg解决未来SAAS项 目需求方案',
                },
                {
                  year: '2016',
                  title: 'jeecg推出重大更新，提升移动开发能力（移动表单配置、移动报表配 置、移动OA，无需编码，通过配置实现移动PC互用）',
                },
              ],
              option: {
                zoom: 1,
                typeBackColor: '#FF4500',
                typeFontColor: '#FFFFFF',
                titleFontSize: 20,
                titleColor: '#1E90FF',
                waitTime: 4000,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '400000100',
        parentId: '400000',
        name: '普通表格',
        compType: 'bar',
        compConfig: null,
        icon: 'JCommonTable',
        children: [
          {
            id: '100112',
            parentId: '400000100',
            name: '数据表格',
            compType: 'JCommonTable',
            compConfig: {
              w: 600,
              h: 400,
              dataType: 1,
              timeOut: 0,
              linkageConfig: [],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              option: {
                headerColor: '#fff',
                headerBgColor: '#FFFFFF00',
                bodyColor: '#FFFFFF',
                bodyBgColor: '#FFFFFF00',
              },
              chartData: [
                {
                  name: '4月',
                  value: 50,
                },
                {
                  name: '2月',
                  value: 200,
                },
                {
                  name: '3月',
                  value: 300,
                },
                {
                  name: '4月',
                  value: 400,
                },
                {
                  name: '5月',
                  value: 50,
                },
                {
                  name: '6月',
                  value: 120,
                },
              ],
            },
            icon: 'ant-design:table-outlined',
          },
          {
            id: '1501439613197119490',
            parentId: '400000100',
            name: '数据列表',
            compType: 'JList',
            compConfig: {
              w: 450,
              h: 230,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/list',
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '标题',
                  mapping: '',
                },
                {
                  filed: '描述',
                  mapping: '',
                },
                {
                  filed: '时间',
                  mapping: '',
                },
                {
                  filed: '封面',
                  mapping: '',
                },
              ],
              timeOut: 0,
              option: {
                showTitlePrefix: true,
                showTimePrefix: true,
                titleFontSize: 18,
                layout: 'horizontal',
                isEnableAnimation: true,
              },
              chartData: [
                {
                  title: '通知一',
                  date: '2022-3-9 14:20:21',
                },
                {
                  title: '通知二',
                  date: '2022-3-8 14:20:21',
                },
                {
                  title: '通知三',
                  date: '2022-3-7 14:20:21',
                },
                {
                  title: '通知四',
                  date: '2022-3-6 14:20:21',
                },
                {
                  title: '通知五',
                  date: '2022-3-5 14:00:00',
                },
              ],
            },
            icon: 'ph:list-numbers',
          }
        ],
      },
      {
        id: '400000200',
        parentId: '400000',
        name: '排名表格',
        compType: 'bar',
        compConfig: null,
        icon: 'JScrollRankingBoard',
        children: [
          {
            id: '1009679509282783232',
            parentId: '400000200',
            name: '排行榜',
            compType: 'JScrollRankingBoard',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '苹果',
                  value: 1000879,
                  type: '手机品牌',
                },
                {
                  name: '三星',
                  value: 3400879,
                  type: '手机品牌',
                },
                {
                  name: '小米',
                  value: 2300879,
                  type: '手机品牌',
                },
                {
                  name: 'oppo',
                  value: 5400879,
                  type: '手机品牌',
                },
                {
                  name: 'vivo',
                  value: 3400879,
                  type: '手机品牌',
                },
              ],
              option: {
                waitTime: 2000,
                rowNum: 5,
                carousel: 'single',
                sort: true,
                fontSize: 13,
                color: "#1370fb",
                textColor: "#fff",
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  textStyle: {
                    color: '#464646',
                    fontWeight: 'normal',
                  },
                },
              },
            },
            icon: null,
          },
          {
            id: '10089046250035931215',
            parentId: '400000200',
            name: '个性排名(前四)',
            compType: 'JFlashList',
            compConfig: {
              w: 540,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '维度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  name: '苹果',
                  value: 1000,
                  type: '手机品牌',
                },
                {
                  name: '三星',
                  value: 34008,
                  type: '手机品牌',
                },
                {
                  name: '小米',
                  value: 2300,
                  type: '手机品牌',
                },
                {
                  name: 'oppo',
                  value: 5400,
                  type: '手机品牌',
                },
                {
                  name: 'vivo',
                  value: 3400,
                  type: '手机品牌',
                },
              ],
              option: {
                zoom: 1,
                titleShow: true,
                title: '排名统计',
                titleSize: 16,
                titleColor: '#00c2ff',
                animateType: 'zoomInUp',
                itemColor: '#00c2ff',
                numberColor: '#00c2ff',
                numberSize: 16,
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
              },
            },
            icon: null,
          },
          {
            id: '10089046350035976704',
            parentId: '400000200',
            name: '气泡排名(前五)',
            compType: 'JBubbleRank',
            compConfig: {
              w: 550,
              h: 400,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/chart',
              timeOut: 0,
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              dataMapping: [
                {
                  filed: '标题',
                  mapping: '',
                },
                {
                  filed: '描述',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  title: 'Java',
                  desc: '事项数：369',
                },
                {
                  title: 'Nodejs',
                  desc: '事项数：258',
                },
                {
                  title: 'Vuejs',
                  desc: '417',
                },
                {
                  title: 'CSS3',
                  desc: '事项数：314',
                },
                {
                  title: 'jQuery',
                  desc: '事项数：216',
                },
              ],
              option: {
                zoom: 1,
                showTip: true,
                tipWidth: 100,
                tipColor: '#0E4C73',
                tipFontSize: 12,
                tipFontColor: '#fff',
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
              },
            },
            icon: null,
          },
        ],
      },
      {
        id: '4000002001',
        parentId: '400000',
        name: '高级表格',
        compType: 'advanced',
        compConfig: null,
        icon: 'advanced',
        children: [
          {
            id: '1756344720727',
            parentId: '4000002001',
            name: '滚动列表(单行)',
            compType: 'JScrollList',
            index:0,
            compConfig: {
              w: 515,
              h: 220,
              dataType: 1,
              timeOut: 0,
              chartData: ScrollListData,
              option: ScrollListOption,
            },
            icon: 'ph:list-numbers',
          },
          {
            id: '1756344720727',
            parentId: '4000002001',
            name: '滚动列表(多行+序号)',
            compType: 'JScrollList',
            index:1,
            compConfig: {
              w: 515,
              h: 220,
              dataType: 1,
              timeOut: 0,
              chartData: ScrollListData1,
              option: ScrollListOption1,
            },
            icon: 'ph:list-numbers',
          },
          {
            id: '1756344720727',
            parentId: '4000002001',
            name: '滚动列表(带表头)',
            compType: 'JScrollList',
            index:2,
            compConfig: {
              w: 515,
              h: 310,
              dataType: 1,
              timeOut: 0,
              chartData: ScrollListData2,
              option: ScrollListOption2,
            },
            icon: 'ph:list-numbers',
          },

        ],
      },
    ],
  },
  {
    id: '707153616621699072',
    show: true,
    parentId: '0',
    name: '自定义',
    compType: 'customForm',
    compConfig: null,
    icon: 'custom',
    children: [
      {
        id: '715067888995565568',
        parentId: '707153616621699072',
        name: 'Online表单',
        compType: 'online',
        compConfig: null,
        icon: 'online',
      },
      {
        id: '732470878136074240',
        parentId: '707153616621699072',
        name: '设计器表单',
        compType: 'design',
        compConfig: null,
        icon: 'design',
      },
      {
        id: '732470878136084390',
        parentId: '707153616621699072',
        name: '统计进度图',
        compType: 'JTotalProgress',
        compConfig: {
          w: 450,
          h: 360,
          dataType: 1,
          url: 'http://api.jeecg.com/mock/33/chart',
          timeOut: 0,
          linkageConfig: [],
          dataMapping: [
            {
              filed: '数值',
              mapping: '',
            },
          ],
          chartData: [
            {
              value: 50,
            },
          ],
          option: {
            targetValue: {},
            series: [
              {
                barWidth: 19,
                label: {
                  show: true,
                  position: 'right',
                  offset: [0, -40],
                  formatter: '{c}{a}',
                  color: 'black',
                  fontSize: 24,
                },
                itemStyle: {
                  normal: {
                    barBorderRadius: 10,
                  },
                },
                color: '#151B87',
                zlevel: 1,
              },
              {
                type: 'bar',
                barGap: '-100%',
                color: '#eeeeee',
                barWidth: 19,
                itemStyle: {
                  normal: {
                    barBorderRadius: 10,
                  },
                },
              },
            ],
          },
        },
        icon: 'ri:bar-chart-horizontal-line',
      },
      {
        id: '732470878193185324',
        parentId: '707153616621699072',
        name: '透视表',
        compType: 'JPivotTable',
        compConfig: {
          w: 450,
          h: 360,
          dataType: 1,
          timeOut: 0,
          chartData: {
            x: [
              {
                '62eb2e00c349cde9883d3c1c': ['测试1', '测试1', '测试2', '测试3'],
              },
              {
                '62f37518df6db6d3e0c9b7ad': ['1', '2', '3', '4'],
              },
            ],
            data: [
              {
                y: ['2022/09', '2022'],
                t_id: '62f37456cf07c28f9312dd13',
                data: [111, null, null, null],
                sum: 111,
                summary_col: false,
              },
              {
                y: ['2022/09', '2022'],
                t_id: '62f37456cf07c28f9312dd14',
                data: [444, null, null, null],
                sum: 444,
                summary_col: false,
              },
              {
                y: ['2022/08', '2022'],
                t_id: '62f37456cf07c28f9312dd13',
                data: [null, 222, 333, 444],
                sum: 999,
                summary_col: false,
              },
              {
                y: ['2022/08', '2022'],
                t_id: '62f37456cf07c28f9312dd14',
                data: [null, 333, 222, 111],
                sum: 666,
                summary_col: false,
              },
              {
                y: [],
                t_id: '62f37456cf07c28f9312dd13',
                data: [111, 222, 333, 444],
                sum: 278,
                summary_col: true,
              },
              {
                y: [],
                t_id: '62f37456cf07c28f9312dd14',
                data: [444, 333, 222, 111],
                sum: 1110,
                summary_col: true,
              },
            ],
          },
          option: {
            card: {
              title: '未命名标题',
              extra: '',
              rightHref: '',
              size: 'default',
            },
          },
        },
        icon: 'ant-design:table-outlined',
      },
      {
        id: '10089046350035976888',
        parentId: '707153616621699072',
        name: '排行榜',
        compType: 'JRankingList',
        compConfig: {
          w: 550,
          h: 400,
          dataType: 1,
          url: 'http://api.jeecg.com/mock/33/chart',
          timeOut: 0,
          turnConfig: {
            url: '',
            type: '_blank',
          },
          linkType: 'url',
          linkageConfig: [],
          dataMapping: [
            {
              filed: '维度',
              mapping: '',
            },
            {
              filed: '数值',
              mapping: '',
            },
          ],
          chartData: [
            {
              name: 'Java',
              value: '事项数：369',
            },
            {
              name: 'Nodejs',
              value: '事项数：258',
            },
          ],
          option: {
            card: {
              title: '',
              extra: '',
              rightHref: '',
              size: 'default',
            },
          },
        },
        icon: null,
      },
    ],
  },
  {
    id: '100120100200',
    show: true,
    parentId: '0',
    name: '地图',
    compType: 'mapMenu',
    compConfig: null,
    icon: 'map',
    children: [
      {
        id: '100120100200320',
        parentId: '100120100200',
        name: '离线地图',
        compType: 'map',
        compConfig: null,
        icon: 'map',
        children: [
          {
            id: '100120100',
            parentId: '100120100200320',
            name: '散点地图',
            compType: 'JBubbleMap',
            compConfig: {
              w: 450,
              h: 360,
              activeKey: 1,
              dataType: 1,
              background: '#FFFFFF00',
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              dataMapping: [
                {
                  filed: '区域',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              jsConfig: '',
              chartData: [
                {
                  name: '北京',
                  value: 199,
                },
                {
                  name: '天津',
                  value: 42,
                },
                {
                  name: '河北',
                  value: 102,
                },
                {
                  name: '山西',
                  value: 81,
                },
                {
                  name: '内蒙古',
                  value: 47,
                },
                {
                  name: '辽宁',
                  value: 67,
                },
                {
                  name: '吉林',
                  value: 82,
                },
                {
                  name: '黑龙江',
                  value: 123,
                },
                {
                  name: '上海',
                  value: 24,
                },
                {
                  name: '江苏',
                  value: 92,
                },
                {
                  name: '浙江',
                  value: 114,
                },
                {
                  name: '安徽',
                  value: 109,
                },
                {
                  name: '福建',
                  value: 116,
                },
                {
                  name: '江西',
                  value: 91,
                },
                {
                  name: '山东',
                  value: 119,
                },
                {
                  name: '河南',
                  value: 137,
                },
                {
                  name: '湖北',
                  value: 116,
                },
                {
                  name: '湖南',
                  value: 114,
                },
                {
                  name: '重庆',
                  value: 91,
                },
                {
                  name: '四川',
                  value: 125,
                },
                {
                  name: '贵州',
                  value: 62,
                },
                {
                  name: '云南',
                  value: 83,
                },
                {
                  name: '西藏',
                  value: 9,
                },
                {
                  name: '陕西',
                  value: 80,
                },
                {
                  name: '甘肃',
                  value: 56,
                },
                {
                  name: '青海',
                  value: 10,
                },
                {
                  name: '宁夏',
                  value: 18,
                },
                {
                  name: '新疆',
                  value: 180,
                },
                {
                  name: '广东',
                  value: 123,
                },
                {
                  name: '广西',
                  value: 59,
                },
                {
                  name: '海南',
                  value: 14,
                },
              ],
              commonOption: {
                barSize: 10,
                barColor: '#fff176',
                barColor2: '#fcc02e',
                gradientColor: false,
                areaColor: {
                  color1: '#132937',
                },
                inRange: {
                  color: ['#04387b', '#467bc0'],
                },
                breadcrumb: {
                  drillDown: false,
                  textColor: '#ffffff',
                },
              },
              option: {
                drillDown: false,
                area: {
                  markerCount: 5,
                  markerSize: 1.5,
                  shadowBlur: 10,
                  markerOpacity: 1,
                  markerColor: '#DDE330',
                  shadowColor: '#DDE330',
                  scatterLabelShow: false,
                  scatterLabelColor: '#ffffff',
                  scatterLabelPosition: 'top',
                  scatterFontSize: 12,
                  markerType: 'effectScatter',
                  markerShape: 'circle',
                  value: ['china'],
                  name: ['中国'],
                },
                graphic: [],
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  left: 10,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                legend: {
                  data: [],
                },
                visualMap: {
                  show: false,
                  min: 0,
                  type: 'continuous',
                  max: 200,
                  left: '5%',
                  top: 'bottom',
                  calculable: true,
                  seriesIndex: [1],
                },
                geo: {
                  top: 40,
                  label: {
                    emphasis: {
                      show: false,
                      color: '#fff',
                    },
                  },
                  roam: true,
                  zoom: 1.2,
                  itemStyle: {
                    normal: {
                      borderWidth: 1,
                      borderColor: '#0692A4',
                      areaColor: '',
                      shadowColor: '#80d9f8',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 0,
                    },
                    emphasis: {
                      areaColor: '#fff59c',
                      borderWidth: 0,
                    },
                  },
                },
              },
            },
            icon: 'ic:outline-scatter-plot',
          },
          {
            id: '100120101',
            parentId: '100120100200320',
            name: '飞线地图',
            compType: 'JFlyLineMap',
            compConfig: {
              w: 600,
              h: 400,
              dataType: 1,
              background: '#FFFFFF00',
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              dataMapping: [
                {
                  filed: '起点名称',
                  mapping: '',
                },
                {
                  filed: '起点经度',
                  mapping: '',
                },
                {
                  filed: '起点纬度',
                  mapping: '',
                },
                {
                  filed: '终点名称',
                  mapping: '',
                },
                {
                  filed: '终点经度',
                  mapping: '',
                },
                {
                  filed: '终点纬度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              chartData: [
                {
                  fromName: '江苏',
                  toName: '贵州',
                  fromLng: 118.8062,
                  fromLat: 31.9208,
                  toLng: 106.6992,
                  toLat: 26.7682,
                  value: 100,
                },
                {
                  fromName: '江苏',
                  toName: '北京',
                  fromLng: 118.8062,
                  fromLat: 31.9208,
                  toLng: 116.46,
                  toLat: 39.92,
                  value: 100,
                },
                {
                  fromName: '新疆',
                  toName: '北京',
                  fromLng: 87.68,
                  fromLat: 43.67,
                  toLng: 116.46,
                  toLat: 39.92,
                  value: 100,
                },
              ],
              commonOption: {
                barSize: 10,
                barColor: '#D6F263',
                barColor2: '#A3DB6B',
                gradientColor: false,
                areaColor: {
                  color1: '#132937',
                },
                inRange: {
                  color: ['#04387b', '#467bc0'],
                },
                effect: {
                  show: true,
                  trailLength: 0,
                  period: 6,
                  symbolSize: 15,
                },
                breadcrumb: {
                  drillDown: false,
                  textColor: '#ffffff',
                },
              },
              option: {
                area: {
                  markerCount: 5,
                  shadowBlur: 10,
                  markerOpacity: 1,
                  markerColor: '#DDE330',
                  shadowColor: '#DDE330',
                  scatterLabelShow: false,
                  markerType: 'effectScatter',
                  value: ['china'],
                  name: ['中国'],
                },
                graphic: [],
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  padding: [5, 0, 0, 15],
                  show: true,
                },
                visualMap: {
                  show: false,
                  min: 0,
                  type: 'continuous',
                  max: 200,
                  left: '5%',
                  top: 'bottom',
                  calculable: true,
                  seriesIndex: [2],
                },
                geo: {
                  top: 30,
                  label: {
                    emphasis: {
                      show: false,
                      color: '#fff',
                    },
                  },
                  roam: true,
                  zoom: 1,
                  itemStyle: {
                    normal: {
                      borderColor: '#0692A4',
                      borderWidth: 1,
                      areaColor: '#323c48',
                      shadowColor: '',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 0,
                    },
                    emphasis: {
                      areaColor: '#EEDD78',
                      borderWidth: 0,
                    },
                  },
                },
              },
            },
            icon: 'la:plane',
          },
          {
            id: '100120102',
            parentId: '100120100200320',
            name: '柱形地图',
            compType: 'JBarMap',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              background: '#FFFFFF00',
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              dataMapping: [
                {
                  filed: '区域',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              chartData: [
                {
                  name: '北京',
                  value: 900,
                },
                {
                  name: '山西',
                  value: 1681,
                },
                {
                  name: '内蒙古',
                  value: 47,
                },
                {
                  name: '辽宁',
                  value: 1667,
                },
                {
                  name: '福建',
                  value: 516,
                },
                {
                  name: '江西',
                  value: 591,
                },
                {
                  name: '山东',
                  value: 419,
                },
                {
                  name: '河南',
                  value: 137,
                },
                {
                  name: '云南',
                  value: 983,
                },
                {
                  name: '西藏',
                  value: 9,
                },
                {
                  name: '陕西',
                  value: 580,
                },
                {
                  name: '甘肃',
                  value: 556,
                },
                {
                  name: '海南',
                  value: 14,
                },
              ],
              commonOption: {
                barSize: 12,
                barColor: '#D6F263',
                barColor2: '#A3DB6B',
                gradientColor: false,
                areaColor: {
                  color1: '#132937',
                },
                inRange: {
                  color: ['#04387b', '#467bc0'],
                },
                breadcrumb: {
                  drillDown: false,
                  textColor: '#ffffff',
                },
              },
              option: {
                drillDown: false,
                tooltip: {
                  trigger: 'item',
                  show: false,
                  enterable: true,
                  textStyle: {
                    fontSize: 20,
                    color: '#fff',
                  },
                  backgroundColor: 'rgba(0,2,89,0.8)',
                  fieldMapping: []
                },
                area: {
                  markerCount: 5,
                  shadowBlur: 10,
                  markerOpacity: 1,
                  markerColor: '#DDE330',
                  shadowColor: '#DDE330',
                  scatterLabelShow: false,
                  markerType: 'effectScatter',
                  value: ['china'],
                  name: ['中国'],
                },
                graphic: [],
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  left: 10,
                  show: true,
                },
                visualMap: {
                  show: false,
                  max: 200,
                  seriesIndex: [0],
                },
                geo: {
                  top: 30,
                  roam: true,
                  aspectScale: 0.96,
                  zoom: 1,
                  itemStyle: {
                    normal: {
                      borderColor: '#0692A4',
                      borderWidth: 1,
                      areaColor: '#37805B',
                      shadowColor: '#80d9f8',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 0,
                    },
                    emphasis: {
                      areaColor: '#fff59c',
                    },
                  },
                },
                'series ': [],
              },
            },
            icon: 'uil:graph-bar',
          },
          {
            id: '100120103',
            parentId: '100120100200320',
            name: '时间轴飞线地图',
            compType: 'JTotalFlyLineMap',
            compConfig: {
              w: 700,
              h: 490,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              background: '#FFFFFF00',
              dataMapping: [
                {
                  filed: '起点名称',
                  mapping: '',
                },
                {
                  filed: '起点经度',
                  mapping: '',
                },
                {
                  filed: '起点纬度',
                  mapping: '',
                },
                {
                  filed: '终点名称',
                  mapping: '',
                },
                {
                  filed: '终点经度',
                  mapping: '',
                },
                {
                  filed: '终点纬度',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
                {
                  filed: '分组',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              chartData: [
                {
                  fromName: '江苏',
                  toName: '贵州',
                  fromLng: 118.8062,
                  fromLat: 31.9208,
                  toLng: 106.6992,
                  toLat: 26.7682,
                  value: 100,
                  group: 2017,
                },
                {
                  fromName: '河南',
                  toName: '云南',
                  fromLng: 113.4668,
                  fromLat: 34.6234,
                  toLng: 102.9199,
                  toLat: 25.4663,
                  value: 100,
                  group: 2017,
                },
                {
                  fromName: '江苏',
                  toName: '甘肃',
                  fromLng: 118.8062,
                  fromLat: 31.9208,
                  toLng: 103.5901,
                  toLat: 36.3043,
                  value: 100,
                  group: 2018,
                },
                {
                  fromName: '江苏',
                  toName: '广东',
                  fromLng: 118.8062,
                  fromLat: 31.9208,
                  toLng: 113.12244,
                  toLat: 31.9208,
                  value: 147,
                  group: 2018,
                },
                {
                  fromName: '江苏',
                  toName: '北京',
                  fromLng: 118.8062,
                  fromLat: 31.9208,
                  toLng: 116.4551,
                  toLat: 40.2539,
                  value: 100,
                  group: 2019,
                },
              ],
              commonOption: {
                barSize: 10,
                barColor: '#D6F263',
                barColor2: '#A3DB6B',
                gradientColor: false,
                areaColor: {
                  color1: '#0A0909',
                  color2: '#3B373700',
                },
                inRange: {
                  color: ['#04387b', '#467bc0'],
                },
                breadcrumb: {
                  drillDown: false,
                  textColor: '#ffffff',
                },
              },
              option: {
                area: {
                  markerCount: 5,
                  shadowBlur: 10,
                  markerOpacity: 1,
                  markerColor: '#DDE330',
                  shadowColor: '#DDE330',
                  scatterLabelShow: false,
                  markerType: 'effectScatter',
                  value: ['china'],
                  name: ['中国'],
                },
                graphic: [],
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  left: 10,
                  textStyle: {
                    fontWeight: 'normal',
                    color: '#70DB93',
                    fontSize: 22,
                  },
                  subtextStyle: {
                    color: '#ffffff',
                    fontSize: 12,
                  },
                },
                geo: {
                  top: 50,
                  left: 100,
                  label: {
                    normal: {
                      show: false,
                    },
                    emphasis: {
                      show: false,
                      color: '#fff',
                    },
                  },
                  roam: false,
                  zoom: 0.9,
                  itemStyle: {
                    normal: {
                      borderColor: '#0692A4',
                      borderWidth: 1,
                      areaColor: '',
                      shadowColor: '#80d9f8',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 0,
                    },
                    emphasis: {
                      areaColor: '#EEDD78',
                      borderWidth: 0,
                    },
                  },
                },
                timeline: {
                  show: true,
                  axisType: 'category',
                  autoPlay: false,
                  playInterval: 2000,
                  left: '10%',
                  right: '5%',
                  bottom: 10,
                  padding: 5,
                  width: '80%',
                  label: {
                    normal: {
                      textStyle: {
                        color: '#ffffff',
                      },
                    },
                    emphasis: {
                      textStyle: {
                        color: '#000000',
                      },
                    },
                  },
                  symbolSize: 10,
                  lineStyle: {
                    color: '#555555',
                  },
                  checkpointStyle: {
                    borderColor: '#777777',
                    borderWidth: 2,
                  },
                  controlStyle: {
                    showNextBtn: true,
                    showPrevBtn: true,
                    normal: {
                      color: '#666666',
                      borderColor: '#666666',
                    },
                    emphasis: {
                      color: '#aaaaaa',
                      borderColor: '#aaaaaa',
                    },
                  },
                },
              },
            },
            icon: 'fluent:airplane-take-off-16-regular',
          },
          {
            id: '100120105',
            parentId: '100120100200320',
            name: '柱形排名地图',
            compType: 'JTotalBarMap',
            compConfig: {
              w: 900,
              h: 600,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              background: '#FFFFFF00',
              dataMapping: [
                {
                  filed: '区域',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
                {
                  filed: '分组',
                  mapping: '',
                },
                {
                  filed: '经度',
                  mapping: '',
                },
                {
                  filed: '纬度',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              chartData: [
                {
                  name: '江苏',
                  lng: 118.8062,
                  lat: 31.9208,
                  value: 500,
                  group: 2017,
                },
                {
                  name: '贵州',
                  lng: 106.6992,
                  lat: 26.7682,
                  value: 100,
                  group: 2017,
                },
                {
                  name: '河南',
                  lng: 113.4668,
                  lat: 34.6234,
                  value: 100,
                  group: 2017,
                },
                {
                  name: '云南',
                  lng: 102.9199,
                  lat: 25.4663,
                  value: 300,
                  group: 2017,
                },
                {
                  name: '江苏',
                  lng: 118.8062,
                  lat: 31.9208,
                  value: 478,
                  group: 2018,
                },
                {
                  name: '贵州',
                  lng: 106.6992,
                  lat: 26.7682,
                  value: 269,
                  group: 2018,
                },
                {
                  name: '河南',
                  lng: 113.4668,
                  lat: 34.6234,
                  value: 128,
                  group: 2018,
                },
                {
                  name: '云南',
                  lng: 102.9199,
                  lat: 25.4663,
                  value: 100,
                  group: 2018,
                },
                {
                  name: '江苏',
                  lng: 118.8062,
                  lat: 31.9208,
                  value: 236,
                  group: 2019,
                },
                {
                  name: '贵州',
                  lng: 106.6992,
                  lat: 26.7682,
                  value: 569,
                  group: 2019,
                },
                {
                  name: '河南',
                  lng: 113.4668,
                  lat: 34.6234,
                  value: 479,
                  group: 2019,
                },
                {
                  name: '云南',
                  lng: 102.9199,
                  lat: 25.4663,
                  value: 259,
                  group: 2019,
                },
              ],
              commonOption: {
                barSize: 10,
                barColor: '#D6F263',
                barColor2: '#A3DB6B',
                gradientColor: false,
                mapTitle: '',
                dataTitle: '数据统计情况',
                dataTitleSize: 20,
                dataTitleColor: '#ffffff',
                dataNameColor: '#dddddd',
                dataValueColor: '#dddddd',
                areaColor: {
                  color1: '#0A0909',
                  color2: '#3B373700',
                },
                grid: {
                  bottom: 50,
                  left: 75,
                  top: 20,
                },
                inRange: {
                  color: ['#04387b', '#467bc0'],
                },
                breadcrumb: {
                  drillDown: false,
                  textColor: '#ffffff',
                },
              },
              option: {
                area: {
                  markerCount: 5,
                  shadowBlur: 10,
                  markerOpacity: 1,
                  markerColor: '#DDE330',
                  shadowColor: '#DDE330',
                  scatterLabelShow: false,
                  markerType: 'effectScatter',
                  value: ['china'],
                  name: ['中国'],
                },
                graphic: [],
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  show: true,
                  left: 10,
                  textStyle: {
                    color: '#ffffff',
                    fontSize: '22px',
                  },
                  subtextStyle: {
                    color: '#ffffff',
                    fontSize: '12px',
                  },
                },
                legend: {
                  data: [],
                },
                radar: [
                  {
                    indicator: [],
                  },
                ],
                timeline: {
                  show: true,
                  axisType: 'category',
                  autoPlay: true,
                  playInterval: 2000,
                  left: '10%',
                  right: '5%',
                  bottom: 5,
                  padding: 5,
                  width: '80%',
                  label: {
                    normal: {
                      textStyle: {
                        color: '#ffffff',
                      },
                    },
                    emphasis: {
                      textStyle: {
                        color: '#000000',
                      },
                    },
                  },
                  symbolSize: 10,
                  lineStyle: {
                    color: '#555555',
                  },
                  checkpointStyle: {
                    borderColor: '#777777',
                    borderWidth: 2,
                  },
                  controlStyle: {
                    showNextBtn: true,
                    showPrevBtn: true,
                    normal: {
                      color: '#666666',
                      borderColor: '#666666',
                    },
                    emphasis: {
                      color: '#aaaaaa',
                      borderColor: '#aaaaaa',
                    },
                  },
                },
                geo: {
                  top: 80,
                  left: '3%',
                  show: true,
                  roam: false,
                  zoom: 0.9,
                  label: {
                    emphasis: {
                      show: false,
                    },
                  },
                  itemStyle: {
                    normal: {
                      borderColor: '#0692A4',
                      borderWidth: 1,
                      areaColor: '#F8E71C',
                      shadowColor: '#80d9f8',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 0,
                    },
                    emphasis: {
                      areaColor: '#EEDD78',
                      borderWidth: 0,
                    },
                  },
                },
              },
            },
            icon: 'ph:chart-bar-horizontal',
          },
          {
            id: '100120106',
            parentId: '100120100200320',
            name: '热力地图',
            compType: 'JHeatMap',
            compConfig: {
              w: 540,
              h: 400,
              dataType: 1,
              background: '#FFFFFF00',
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              dataMapping: [
                {
                  filed: '区域',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              chartData: [
                {
                  name: '海门',
                  value: 100,
                },
                {
                  name: '鄂尔多斯',
                  value: 112,
                },
                {
                  name: '招远',
                  value: 112,
                },
                {
                  name: '舟山',
                  value: 112,
                },
                {
                  name: '齐齐哈尔',
                  value: 114,
                },
                {
                  name: '盐城',
                  value: 100,
                },
                {
                  name: '赤峰',
                  value: 16,
                },
                {
                  name: '青岛',
                  value: 450,
                },
                {
                  name: '乳山',
                  value: 118,
                },
                {
                  name: '金昌',
                  value: 119,
                },
                {
                  name: '泉州',
                  value: 21,
                },
                {
                  name: '莱西',
                  value: 300,
                },
                {
                  name: '日照',
                  value: 121,
                },
                {
                  name: '胶南',
                  value: 125,
                },
                {
                  name: '南通',
                  value: 23,
                },
                {
                  name: '拉萨',
                  value: 321,
                },
                {
                  name: '云浮',
                  value: 444,
                },
                {
                  name: '梅州',
                  value: 25,
                },
                {
                  name: '文登',
                  value: 456,
                },
                {
                  name: '上海',
                  value: 125,
                },
                {
                  name: '攀枝花',
                  value: 125,
                },
                {
                  name: '威海',
                  value: 25,
                },
                {
                  name: '承德',
                  value: 25,
                },
                {
                  name: '厦门',
                  value: 126,
                },
                {
                  name: '汕尾',
                  value: 26,
                },
                {
                  name: '潮州',
                  value: 247,
                },
                {
                  name: '丹东',
                  value: 227,
                },
                {
                  name: '太仓',
                  value: 427,
                },
                {
                  name: '曲靖',
                  value: 327,
                },
                {
                  name: '烟台',
                  value: 28,
                },
                {
                  name: '福州',
                  value: 29,
                },
                {
                  name: '瓦房店',
                  value: 30,
                },
                {
                  name: '即墨',
                  value: 30,
                },
                {
                  name: '抚顺',
                  value: 31,
                },
                {
                  name: '玉溪',
                  value: 31,
                },
                {
                  name: '张家口',
                  value: 31,
                },
                {
                  name: '阳泉',
                  value: 31,
                },
                {
                  name: '莱州',
                  value: 32,
                },
                {
                  name: '湖州',
                  value: 32,
                },
                {
                  name: '汕头',
                  value: 32,
                },
                {
                  name: '昆山',
                  value: 33,
                },
                {
                  name: '宁波',
                  value: 33,
                },
                {
                  name: '湛江',
                  value: 33,
                },
                {
                  name: '揭阳',
                  value: 34,
                },
                {
                  name: '荣成',
                  value: 34,
                },
                {
                  name: '连云港',
                  value: 35,
                },
                {
                  name: '葫芦岛',
                  value: 35,
                },
                {
                  name: '常熟',
                  value: 236,
                },
                {
                  name: '东莞',
                  value: 336,
                },
                {
                  name: '河源',
                  value: 36,
                },
                {
                  name: '淮安',
                  value: 436,
                },
                {
                  name: '泰州',
                  value: 236,
                },
                {
                  name: '南宁',
                  value: 437,
                },
                {
                  name: '营口',
                  value: 37,
                },
                {
                  name: '惠州',
                  value: 337,
                },
                {
                  name: '江阴',
                  value: 37,
                },
                {
                  name: '蓬莱',
                  value: 37,
                },
                {
                  name: '韶关',
                  value: 38,
                },
                {
                  name: '嘉峪关',
                  value: 38,
                },
                {
                  name: '广州',
                  value: 138,
                },
                {
                  name: '延安',
                  value: 138,
                },
                {
                  name: '太原',
                  value: 139,
                },
                {
                  name: '清远',
                  value: 139,
                },
                {
                  name: '中山',
                  value: 139,
                },
                {
                  name: '昆明',
                  value: 139,
                },
                {
                  name: '寿光',
                  value: 440,
                },
                {
                  name: '盘锦',
                  value: 40,
                },
                {
                  name: '长治',
                  value: 41,
                },
                {
                  name: '深圳',
                  value: 41,
                },
                {
                  name: '珠海',
                  value: 42,
                },
                {
                  name: '宿迁',
                  value: 43,
                },
                {
                  name: '咸阳',
                  value: 43,
                },
                {
                  name: '铜川',
                  value: 44,
                },
                {
                  name: '平度',
                  value: 44,
                },
                {
                  name: '佛山',
                  value: 44,
                },
                {
                  name: '海口',
                  value: 44,
                },
                {
                  name: '江门',
                  value: 45,
                },
                {
                  name: '章丘',
                  value: 45,
                },
                {
                  name: '肇庆',
                  value: 46,
                },
                {
                  name: '大连',
                  value: 47,
                },
                {
                  name: '临汾',
                  value: 47,
                },
                {
                  name: '吴江',
                  value: 47,
                },
                {
                  name: '石嘴山',
                  value: 49,
                },
                {
                  name: '沈阳',
                  value: 50,
                },
                {
                  name: '苏州',
                  value: 50,
                },
                {
                  name: '茂名',
                  value: 50,
                },
                {
                  name: '嘉兴',
                  value: 51,
                },
                {
                  name: '长春',
                  value: 51,
                },
                {
                  name: '胶州',
                  value: 52,
                },
                {
                  name: '银川',
                  value: 52,
                },
                {
                  name: '张家港',
                  value: 52,
                },
                {
                  name: '三门峡',
                  value: 53,
                },
                {
                  name: '锦州',
                  value: 154,
                },
                {
                  name: '南昌',
                  value: 154,
                },
                {
                  name: '柳州',
                  value: 154,
                },
                {
                  name: '三亚',
                  value: 154,
                },
                {
                  name: '自贡',
                  value: 156,
                },
                {
                  name: '吉林',
                  value: 156,
                },
                {
                  name: '阳江',
                  value: 257,
                },
                {
                  name: '泸州',
                  value: 157,
                },
                {
                  name: '西宁',
                  value: 157,
                },
                {
                  name: '宜宾',
                  value: 258,
                },
                {
                  name: '呼和浩特',
                  value: 58,
                },
                {
                  name: '成都',
                  value: 58,
                },
                {
                  name: '大同',
                  value: 58,
                },
                {
                  name: '镇江',
                  value: 59,
                },
                {
                  name: '桂林',
                  value: 59,
                },
                {
                  name: '张家界',
                  value: 59,
                },
                {
                  name: '宜兴',
                  value: 59,
                },
                {
                  name: '北海',
                  value: 60,
                },
                {
                  name: '西安',
                  value: 61,
                },
                {
                  name: '金坛',
                  value: 62,
                },
                {
                  name: '东营',
                  value: 62,
                },
                {
                  name: '牡丹江',
                  value: 63,
                },
                {
                  name: '遵义',
                  value: 63,
                },
                {
                  name: '绍兴',
                  value: 63,
                },
                {
                  name: '扬州',
                  value: 64,
                },
                {
                  name: '常州',
                  value: 64,
                },
                {
                  name: '潍坊',
                  value: 65,
                },
                {
                  name: '重庆',
                  value: 66,
                },
                {
                  name: '台州',
                  value: 67,
                },
                {
                  name: '南京',
                  value: 67,
                },
                {
                  name: '滨州',
                  value: 70,
                },
                {
                  name: '贵阳',
                  value: 71,
                },
                {
                  name: '无锡',
                  value: 71,
                },
                {
                  name: '本溪',
                  value: 71,
                },
                {
                  name: '克拉玛依',
                  value: 72,
                },
                {
                  name: '渭南',
                  value: 72,
                },
                {
                  name: '马鞍山',
                  value: 72,
                },
                {
                  name: '宝鸡',
                  value: 72,
                },
                {
                  name: '焦作',
                  value: 75,
                },
                {
                  name: '句容',
                  value: 75,
                },
                {
                  name: '北京',
                  value: 79,
                },
                {
                  name: '徐州',
                  value: 79,
                },
                {
                  name: '衡水',
                  value: 80,
                },
                {
                  name: '包头',
                  value: 80,
                },
                {
                  name: '绵阳',
                  value: 80,
                },
                {
                  name: '乌鲁木齐',
                  value: 84,
                },
                {
                  name: '枣庄',
                  value: 84,
                },
                {
                  name: '杭州',
                  value: 84,
                },
                {
                  name: '淄博',
                  value: 85,
                },
                {
                  name: '鞍山',
                  value: 86,
                },
                {
                  name: '溧阳',
                  value: 86,
                },
                {
                  name: '库尔勒',
                  value: 86,
                },
                {
                  name: '安阳',
                  value: 190,
                },
                {
                  name: '开封',
                  value: 390,
                },
                {
                  name: '济南',
                  value: 292,
                },
                {
                  name: '德阳',
                  value: 393,
                },
                {
                  name: '温州',
                  value: 95,
                },
                {
                  name: '九江',
                  value: 96,
                },
                {
                  name: '邯郸',
                  value: 98,
                },
                {
                  name: '临安',
                  value: 99,
                },
                {
                  name: '兰州',
                  value: 99,
                },
                {
                  name: '沧州',
                  value: 100,
                },
                {
                  name: '临沂',
                  value: 103,
                },
                {
                  name: '南充',
                  value: 104,
                },
                {
                  name: '天津',
                  value: 105,
                },
                {
                  name: '富阳',
                  value: 106,
                },
                {
                  name: '泰安',
                  value: 112,
                },
                {
                  name: '诸暨',
                  value: 112,
                },
                {
                  name: '郑州',
                  value: 113,
                },
                {
                  name: '哈尔滨',
                  value: 114,
                },
                {
                  name: '聊城',
                  value: 116,
                },
                {
                  name: '芜湖',
                  value: 117,
                },
                {
                  name: '唐山',
                  value: 119,
                },
                {
                  name: '平顶山',
                  value: 119,
                },
                {
                  name: '邢台',
                  value: 119,
                },
                {
                  name: '德州',
                  value: 120,
                },
                {
                  name: '济宁',
                  value: 120,
                },
                {
                  name: '荆州',
                  value: 127,
                },
                {
                  name: '宜昌',
                  value: 130,
                },
                {
                  name: '义乌',
                  value: 132,
                },
                {
                  name: '丽水',
                  value: 133,
                },
                {
                  name: '洛阳',
                  value: 134,
                },
                {
                  name: '秦皇岛',
                  value: 136,
                },
                {
                  name: '株洲',
                  value: 143,
                },
                {
                  name: '石家庄',
                  value: 147,
                },
                {
                  name: '莱芜',
                  value: 148,
                },
                {
                  name: '常德',
                  value: 152,
                },
                {
                  name: '保定',
                  value: 153,
                },
                {
                  name: '湘潭',
                  value: 154,
                },
                {
                  name: '金华',
                  value: 157,
                },
                {
                  name: '岳阳',
                  value: 169,
                },
                {
                  name: '长沙',
                  value: 175,
                },
                {
                  name: '衢州',
                  value: 177,
                },
                {
                  name: '廊坊',
                  value: 193,
                },
                {
                  name: '菏泽',
                  value: 194,
                },
                {
                  name: '合肥',
                  value: 229,
                },
                {
                  name: '武汉',
                  value: 273,
                },
                {
                  name: '大庆',
                  value: 279,
                },
              ],
              commonOption: {
                barSize: 10,
                barColor: '#D6F263',
                barColor2: '#A3DB6B',
                gradientColor: false,
                areaColor: {
                  color1: '#132937',
                },
                heat: {
                  pointSize: 6,
                  blurSize: 13,
                  maxOpacity: 1,
                },
                inRange: {
                  color: ['#E08D8D', '#ff9800'],
                },
                breadcrumb: {
                  drillDown: false,
                  textColor: '#ffffff',
                },
              },
              option: {
                drillDown: false,
                area: {
                  markerCount: 5,
                  shadowBlur: 10,
                  markerOpacity: 1,
                  markerColor: '#df2425',
                  shadowColor: '#DDE330',
                  scatterLabelShow: false,
                  markerType: 'effectScatter',
                  value: ['china'],
                  name: ['中国'],
                },
                graphic: [],
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  left: 10,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                legend: {
                  data: [],
                },
                visualMap: {
                  show: true,
                  min: 0,
                  type: 'continuous',
                  max: 200,
                  left: '5%',
                  top: 'auto',
                  bottom: '1%',
                  calculable: true,
                  seriesIndex: [1],
                },
                geo: {
                  top: 30,
                  label: {
                    emphasis: {
                      show: false,
                      color: '#fff',
                    },
                  },
                  roam: true,
                  zoom: 1,
                  itemStyle: {
                    normal: {
                      borderColor: '#0692A4',
                      borderWidth: 1,
                      areaColor: '',
                      shadowColor: '#80d9f8',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 0,
                    },
                    emphasis: {
                      areaColor: '#fff59c',
                      borderWidth: 0,
                    },
                  },
                },
              },
            },
            icon: 'carbon:heat-map-02',
          },
          {
            id: '100120107',
            parentId: '100120100200320',
            name: '区域地图',
            compType: 'JAreaMap',
            compConfig: {
              w: 450,
              h: 300,
              activeKey: 1,
              dataType: 1,
              background: '#FFFFFF00',
              url: 'http://api.jeecg.com/mock/33/radar',
              timeOut: 0,
              dataMapping: [
                {
                  filed: '区域',
                  mapping: '',
                },
                {
                  filed: '数值',
                  mapping: '',
                },
              ],
              turnConfig: {
                url: '',
                type: '_blank',
              },
              linkType: 'url',
              linkageConfig: [],
              jsConfig: '',
              chartData: [
                {
                  name: '北京',
                  value: 199,
                },
                {
                  name: '天津',
                  value: 42,
                },
                {
                  name: '河北',
                  value: 102,
                },
                {
                  name: '山西',
                  value: 81,
                },
                {
                  name: '内蒙古',
                  value: 47,
                },
                {
                  name: '辽宁',
                  value: 67,
                },
                {
                  name: '吉林',
                  value: 82,
                },
                {
                  name: '黑龙江',
                  value: 123,
                },
                {
                  name: '上海',
                  value: 24,
                },
                {
                  name: '江苏',
                  value: 92,
                },
                {
                  name: '浙江',
                  value: 114,
                },
                {
                  name: '安徽',
                  value: 109,
                },
                {
                  name: '福建',
                  value: 116,
                },
                {
                  name: '江西',
                  value: 91,
                },
                {
                  name: '山东',
                  value: 119,
                },
                {
                  name: '河南',
                  value: 137,
                },
                {
                  name: '湖北',
                  value: 116,
                },
                {
                  name: '湖南',
                  value: 114,
                },
                {
                  name: '重庆',
                  value: 91,
                },
                {
                  name: '四川',
                  value: 125,
                },
                {
                  name: '贵州',
                  value: 62,
                },
                {
                  name: '云南',
                  value: 83,
                },
                {
                  name: '西藏',
                  value: 9,
                },
                {
                  name: '陕西',
                  value: 80,
                },
                {
                  name: '甘肃',
                  value: 56,
                },
                {
                  name: '青海',
                  value: 10,
                },
                {
                  name: '宁夏',
                  value: 18,
                },
                {
                  name: '新疆',
                  value: 180,
                },
                {
                  name: '广东',
                  value: 123,
                },
                {
                  name: '广西',
                  value: 59,
                },
                {
                  name: '海南',
                  value: 14,
                },
              ],
              commonOption: {
                barSize: 10,
                barColor: '#fff176',
                barColor2: '#fcc02e',
                gradientColor: false,
                areaColor: {
                  color1: '#132937',
                  color2: '#fcc02e',
                },
                inRange: {
                  color: ['#04387b', '#467bc0'],
                },
                breadcrumb: {
                  drillDown: false,
                  textColor: '#ffffff',
                },
              },
              option: {
                drillDown: false,
                tooltip:{
                  fieldMapping: []  
                },
                area: {
                  markerCount: 5,
                  shadowBlur: 10,
                  markerOpacity: 1,
                  markerColor: '#DDE330',
                  shadowColor: '#DDE330',
                  scatterLabelShow: false,
                  markerType: 'effectScatter',
                  value: ['china'],
                  name: ['中国'],
                },
                graphic: [],
                grid: {
                  show: false,
                  bottom: 115,
                },
                card: {
                  title: '',
                  extra: '',
                  rightHref: '',
                  size: 'default',
                },
                title: {
                  text: '',
                  textAlign: 'left',
                  left: 10,
                  textStyle: {
                    fontWeight: 'normal',
                  },
                  show: true,
                },
                legend: {
                  data: [],
                },
                visualMap: {
                  show: false,
                  min: 0,
                  type: 'continuous',
                  max: 200,
                  left: '5%',
                  top: 'auto',
                  bottom: '1%',
                  calculable: true,
                  seriesIndex: [0],
                  textStyle:{
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 12,
                  },
                },
                geo: {
                  top: 30,
                  label: {
                    emphasis: {
                      show: false,
                      color: '#fff',
                    },
                  },
                  roam: false,
                  zoom: 1,
                  itemStyle: {
                    normal: {
                      borderColor: '#0692A4',
                      borderWidth: 1,
                      areaColor: '',
                      shadowColor: '#80d9f8',
                      shadowOffsetX: 0,
                      shadowOffsetY: 0,
                      shadowBlur: 0,
                    },
                    emphasis: {
                      areaColor: '#fff59c',
                      borderWidth: 0,
                    },
                  },
                },
              },
            },
            icon: 'ic:outline-scatter-plot',
          },
        ],
      },
      {
        id: '1757055654971',
        parentId: '100120100200',
        name: '在线地图',
        compType: 'map',
        compConfig: null,
        icon: 'map',
        children: [
          {
            id: '1754363680796',
            parentId: '100120100200320',
            name: '高德地图',
            compType: 'JGaoDeMap',
            compConfig: {
              w: 500,
              h: 500,
              background: '#FFFFFF00',
              dataType: 1,
              timeOut: 0,
              option: gaoDeMapOption,
              chartData: gaoDeMapData
            },
          }
        ]
      }
    ],
  },
  {
    id: '1009728871115423744',
    show: true,
    parentId: '0',
    name: '视频',
    compType: 'video',
    compConfig: null,
    icon: 'JVideoPlay',
    children: [
      {
        id: '610000',
        parentId: '1009728871115423744',
        name: '视频',
        compType: '',
        icon: 'JVideoPlay',
        children: [
          {
            id: '1011160078130774016',
            parentId: '610000',
            name: '播放器',
            compType: 'JVideoPlay',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              url: 'http://api.jeecg.com/mock/42/nav',
              timeOut: 0,
              background: '#4A90E2',
              dataMapping: [
                {
                  filed: '路径',
                  mapping: '',
                },
              ],
              chartData: [
                {
                  src: 'http://vjs.zencdn.net/v/oceans.mp4',
                },
              ],
              option: {
                autoPlay: false,
                loop: true,
              },
            },
            icon: 'JVideoPlay',
          },
          {
            id: '1022260078130774016',
            parentId: '610000',
            name: 'RTMP播放器',
            compType: 'JVideoJs',
            compConfig: {
              w: 450,
              h: 300,
              dataType: 1,
              timeOut: 0,
              option: {
                url: 'http://vjs.zencdn.net/v/oceans.mp4',
              },
            },
            icon: null,
          },
        ],
      },
    ],
  },
  {
    id: '100',
    show: true,
    parentId: '0',
    name: '其他',
    compType: '',
    compConfig: null,
    icon: 'JCommon',
    children: [
      {
        id: '1005158712659767296',
        parentId: '100',
        name: '选项卡',
        compType: 'JSelectRadio',
        compConfig: {
          w: 400,
          h: 80,
          dataType: 1,
          url: 'http://api.jeecg.com/mock/42/nav',
          timeOut: 0,
          turnConfig: {
            url: '',
            type: '_blank',
          },
          linkType: 'url',
          linkageConfig: [],
          compShowConfig: [],
          dataMapping: [
            {
              filed: '文本',
              mapping: '',
            },
            {
              filed: '数值',
              mapping: '',
            },
          ],
          chartData: [
            {
              label: '选项一',
              value: '1',
            },
            {
              label: '选项二',
              value: '2',
            },
            {
              label: '选项三',
              value: '3',
            },
          ],
          option: {
            fontSize: 16,
            color: '#fff',
            type: 'radio',
            padding: 0,

            backgroundColor: '#39414d',
            backgroundImage: '',
            borderColor: '',
            borderWidth: 0,

            activeColor: '#fff',
            activeBackgroundColor: '#0a73ff',
            activeBackgroundImage: '',
            activeBorderColor: '',
            activeBorderWidth: 0,
          },
        },
        icon: 'JSelectRadio',
      },
      {
        id: '1755671992579',
        parentId: '100',
        name: '导航切换',
        compType: 'JTabToggle',
        compConfig: {
          w: 680,
          h: 70,
          dataType: 1,
          containDataType: [1],
          timeOut: 0,
          dataMapping: [
           {
              filed: '文本',
              mapping: '',
            },
            {
              filed: '数值',
              mapping: '',
            },
          ],
          chartData: [
            {
              label: '总览图',
              value: '1',
            },
            {
              label: '产城业务板块',
              value: '2',
            },
            {
              label: '产融业务板块',
              value: '3',
            },
            {
              label: '环投业务板块',
              value: '4',
            },
            {
              label: '建设业务板块',
              value: '5',
            },
          ],
          option: {
            personalizedMode: true,
            currentValue: null,
            normal: {
              fontSize: 20,
              color: '#d8d8d8',
              backgroundColor: '#3a414d',
              borderColor: '#0692A4',
              borderWidth: 0,
              imgUrl: '',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center center',
              gradient: {
                enabled: true,
                type: 'linear',
                direction: 'to bottom',
                startColor: '#00d4ff',
                endColor: '#0066cc',
              },
            },
            active: {
              fontSize: 24,
              color: '#ffffff',
              backgroundColor: '#0a73ff',
              borderColor: '#0692A4',
              borderWidth: 0,
              imgUrl: '',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center center',
              gradient: {
                enabled: true,
                type: 'linear',
                direction: 'to bottom',
                startColor: '#ffcc00',
                endColor: '#ff6600',
              },
            },
            items:[
              {
                value: '1',
                label: '总览图',
                normalImgUrl: navItem01,
                activeImgUrl: navItem01_hover,
                width: 98,
                compVals:[],
              },
              {
                value: '2',
                label: '产城业务板块',
                normalImgUrl: navItem02,
                activeImgUrl: navItem02_hover,
                compVals:[],
              },
              {
                value: '3',
                label: '产融业务板块',
                normalImgUrl: navItem03,
                activeImgUrl: navItem03_hover,
                compVals:[],
              },
              {
                value: '4',
                label: '环投业务板块',
                normalImgUrl: navItem04,
                activeImgUrl: navItem04_hover,
                compVals:[],
              },
              {
                value: '5',
                label: '建设业务板块',
                normalImgUrl: navItem05,
                activeImgUrl: navItem05_hover,
                compVals:[],
              },
            ]
          },
        },
        icon: 'JSelectRadio',
      },
      {
        id: '100100',
        parentId: '100',
        name: '表单',
        compType: 'JForm',
        compConfig: {
          w: 1000,
          h: 90,
          dataType: 1,
          timeOut: 0,
          showBtn: true,
          linkType: 'comp',
          linkageConfig: [],
          option: {
            fields: [
              {
                fieldName: 'name',
                dictCode: '',
                dateFormat: '',
                fieldTxt: '名称',
                defaultValue: '',
                searchMode: 'single',
                orderNum: '',
                action: '',
                id: 'rowfb1d97b6-d9f0-41d9-a282-4bab1607dd72',
                izSearch: '1',
                widgetType: 'input',
              },
              {
                fieldName: 'sex',
                dictCode: 'sex',
                dateFormat: '',
                fieldTxt: '性别',
                defaultValue: '',
                searchMode: 'single',
                orderNum: '',
                action: '',
                id: 'row1e5d23c0-15d0-499f-85c0-062d1a210317',
                izSearch: '1',
                widgetType: 'input',
              },
            ],
            showSubmitBtn: true,
            showResetBtn: true,
            mode: 'dark',
          },
        },
        icon: 'JForm',
      },
      {
        id: '100108',
        parentId: '100',
        name: 'Iframe',
        compType: 'JIframe',
        compConfig: {
          w: 450,
          h: 300,
          dataType: 1,
          url: 'http://api.jeecg.com/mock/42/nav',
          timeOut: 0,
          linkageConfig: [],
          chartData: 'http://www.jeecg.com',
          option: {
            card: {
              title: '',
              extra: '',
              rightHref: '',
              size: 'default',
            },
            body: {
              url: 'https://help.jeecg.com',
            },
          },
        },
        icon: 'iframe',
      },
      // {
      //   id: '15013142797119490',
      //   parentId: '100',
      //   name: '日历',
      //   compType: 'JCalendar',
      //   compConfig: {
      //     w: 450,
      //     h: 300,
      //     dataType: 1,
      //     linkageConfig: [],
      //     url: 'http://api.jeecg.com/mock/42/calendar',
      //     timeOut: 0,
      //     dataMapping: [
      //       {
      //         filed: '标题',
      //         mapping: '',
      //       },
      //       {
      //         filed: '开始',
      //         mapping: '',
      //       },
      //       {
      //         filed: '结束',
      //         mapping: '',
      //       },
      //       {
      //         filed: '全天',
      //         mapping: '',
      //       },
      //       {
      //         filed: '颜色',
      //         mapping: '',
      //       },
      //     ],
      //     chartData: [
      //       {
      //         title: '座谈会',
      //         start: '2022-03-11 11:32:33',
      //         end: '2022-03-11 18:32:33',
      //         color: '#000000',
      //         allday: '0',
      //       },
      //       {
      //         title: '冬奥会',
      //         start: '2022-03-04 11:32:33',
      //         end: '2022-03-13 18:32:33',
      //         color: '#4A90E2',
      //         allday: '1',
      //       },
      //     ],
      //   },
      //   icon: 'ic:baseline-calendar-month',
      // },
      {
        id: '100111',
        parentId: '100',
        name: '按钮',
        compType: 'JRadioButton',
        compConfig: {
          w: 540,
          h: 150,
          dataType: 1,
          url: '',
          timeOut: 0,
          turnConfig: {
            url: '',
            type: '_blank',
          },
          linkType: 'url',
          linkageConfig: [],
          background: '#14141400',
          dataMapping: [
            {
              filed: '标题',
              mapping: '',
            },
            {
              filed: '跳转',
              mapping: '',
            },
          ],
          chartData: [
            {
              title: '按钮一',
              value: 0,
              href: '',
              data: {},
            },
            {
              title: '按钮二',
              value: 1,
              href: '',
              data: {},
            },
            {
              title: '按钮三',
              value: 2,
              href: '',
              data: {},
            },
            {
              title: '按钮四',
              value: 3,
              href: '',
              data: {},
            },
            {
              title: '按钮五',
              value: 4,
              href: '',
              data: {},
            },
          ],
          option: {
            title: '按钮',
            card: {
              title: '',
              extra: '',
              rightHref: '',
              size: 'default',
            },
            body: {
              size: 'small',
              spaceSize: 20,
              shape: 'circle',
            },
            customColor: [
              {
                color: '#1A7DED',
              },
              {
                color: '#F8E71C',
              },
              {
                color: '#B8E986',
              },
              {
                color: '#50E3C2',
              },
            ],
          },
        },
        icon: 'JRadioButton',
      },
      {
        id: '1541744572086898690',
        parentId: '100',
        name: '富文本',
        compType: 'JDragEditor',
        compConfig: {
          w: 450,
          h: 300,
          dataType: 1,
          timeOut: 0,
          chartData: '富文本内容...',
          option: {},
        },
        icon: 'JDragEditor',
      },
      {
        id: '200400',
        parentId: '100',
        name: '通用组件',
        compType: 'JCommon',
        compConfig: {
          w: 450,
          h: 300,
          dataType: 1,
          background: '#ffffff00',
          url: 'http://api.jeecg.com/mock/33/chart',
          timeOut: 0,
          turnConfig: {
            url: '',
          },
          linkageConfig: [],
          dataMapping: [],
          customOption:
            "option = {xAxis: {type: 'category',data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']},yAxis: {type: 'value'},series: [{data: [150, 230, 224, 218, 135, 147, 260],type: 'line'}]};return option;",
          chartData: [
            {
              value: 0,
              name: '',
            },
          ],
          option: {
            grid: {
              top: 12,
              bottom: 18,
              right: 50,
              left: 0,
              containLabel: true,
            },
            card: {
              title: '',
              extra: '',
              rightHref: '',
              size: 'default',
            },
            title: {
              text: '',
              textAlign: 'left',
              show: true,
            },
          },
        },
        icon: 'JCommon',
      },

      {
        id: '200500',
        parentId: '100',
        name: '自定义组件',
        compType: 'JCustomEchart',
        compConfig: {
          w: 450,
          h: 300,
          dataType: 1,
          background: '#ffffff00',
          url: '',
          timeOut: 0,
          definitionOption: {
            color: ['#80FFA5', '#00DDFF', '#37A2FF', '#FF0087', '#FFBF00'],
            title: {
              text: '折线图'
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
                label: {
                  backgroundColor: '#6a7985'
                }
              }
            },
            legend: {
              data: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']
            },
            grid: {
              left: '3%',
              right: '4%',
              bottom: '3%',
              containLabel: true
            },
            xAxis: [
              {
                type: 'category',
                boundaryGap: false,
                data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              }
            ],
            yAxis: [
              {
                type: 'value'
              }
            ],
            series: [
              {
                name: 'Line 1',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(128, 255, 165)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(1, 191, 236)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [140, 232, 101, 264, 90, 340, 250]
              },
              {
                name: 'Line 2',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(0, 221, 255)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(77, 119, 255)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [120, 282, 111, 234, 220, 340, 310]
              },
              {
                name: 'Line 3',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(55, 162, 255)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(116, 21, 219)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [320, 132, 201, 334, 190, 130, 220]
              },
              {
                name: 'Line 4',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(255, 0, 135)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(135, 0, 157)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [220, 402, 231, 134, 190, 230, 120]
              },
              {
                name: 'Line 5',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                label: {
                  show: true,
                  position: 'top'
                },
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(255, 191, 0)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(224, 62, 76)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [220, 302, 181, 234, 210, 290, 150]
              }
            ]
          },
          chartData: {
            color: ['#80FFA5', '#00DDFF', '#37A2FF', '#FF0087', '#FFBF00'],
            title: {
              text: '折线图'
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
                label: {
                  backgroundColor: '#6a7985'
                }
              }
            },
            legend: {
              data: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']
            },
            grid: {
              left: '3%',
              right: '4%',
              bottom: '3%',
              containLabel: true
            },
            xAxis: [
              {
                type: 'category',
                boundaryGap: false,
                data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              }
            ],
            yAxis: [
              {
                type: 'value'
              }
            ],
            series: [
              {
                name: 'Line 1',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(128, 255, 165)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(1, 191, 236)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [140, 232, 101, 264, 90, 340, 250]
              },
              {
                name: 'Line 2',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(0, 221, 255)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(77, 119, 255)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [120, 282, 111, 234, 220, 340, 310]
              },
              {
                name: 'Line 3',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(55, 162, 255)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(116, 21, 219)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [320, 132, 201, 334, 190, 130, 220]
              },
              {
                name: 'Line 4',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(255, 0, 135)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(135, 0, 157)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [220, 402, 231, 134, 190, 230, 120]
              },
              {
                name: 'Line 5',
                type: 'line',
                stack: 'Total',
                smooth: true,
                lineStyle: {
                  width: 0
                },
                showSymbol: false,
                label: {
                  show: true,
                  position: 'top'
                },
                areaStyle: {
                  opacity: 0.8,
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                      offset: 0,
                      color: 'rgb(255, 191, 0)'
                    },
                    {
                      offset: 1,
                      color: 'rgb(224, 62, 76)'
                    }
                  ])
                },
                emphasis: {
                  focus: 'series'
                },
                data: [220, 302, 181, 234, 210, 290, 150]
              }
            ]
          },
          option: {
            grid: {
              top: 12,
              bottom: 18,
              right: 50,
              left: 0,
              containLabel: true,
            },
            card: {
              title: '',
              extra: '',
              rightHref: '',
              size: 'default',
            },
            title: {
              text: '',
              textAlign: 'left',
              show: true,
            },
          }
        },
        icon: 'JCommon',
      },
    ],
  },
];
