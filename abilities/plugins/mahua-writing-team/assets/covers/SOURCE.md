# 封面的纸纹底片

`01.jpg` – `04.jpg` 是四张 360×540 的灰度影像，由 [Lorem Picsum](https://picsum.photos) 生成：

```
https://picsum.photos/seed/mahua-paper-N/360/540?grayscale&blur=2   # N = 1..4
```

Picsum 的图源来自 [Unsplash](https://unsplash.com)，按 [Unsplash License](https://unsplash.com/license)
使用（允许商用与修改，无需署名；不得转售未修改的原图，也不得用它们搭建同类图库服务）。

## 它们是怎么被用的

不以原图出现。`src/features/workbench/cover-art.ts` 把四张图内联进构建产物，`style.css` 里的
`.mahua-cover .cover-texture` 把它以 `opacity: 0.18` + `multiply` 叠在纸底色之上——留下的只是纸的纤维感，
不是一张插画。书名首字、图案与纸色仍由生成式封面提供。

## 想换观感

直接替换这四个文件即可，代码不用动（`?inline` 会在构建时重新内联）。若增减张数，同步改
`src/features/workbench/workbench-model.ts` 的 `COVER_ART_COUNT` 与 `cover-art.ts` 的清单。
