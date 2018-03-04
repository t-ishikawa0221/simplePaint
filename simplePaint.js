class PaintUtil {
    static get CANVAS_WIDTH() {
        return screen.width;
    }
    static get CANVAS_HEIGHT() {
        return screen.height;
    }
    // 画像リサイズ
    static ImgB64Resize(imgData, width, height, callback) {
        let img_type = imgData.substring(5, imgData.indexOf(";"));
        let img = new Image();
        img.onload = function () {
            let canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            let imgB64_dst = canvas.toDataURL(img_type);
            callback(imgB64_dst);
        };
        img.src = imgData;
    }
    // iOSの画像回転に対応
    static loadImageFile(file, callback) {
        let canvas = document.createElement('canvas');
        let options = { canvas: true };
        loadImage.parseMetaData(file, function (data) {
            if (data.exif) {
                options.orientation = data.exif.get('Orientation');
            }
            loadImage(file, callback, options);
        });
    }
};

$(document).ready(function () {
    $("#paintArea").attr("width", PaintUtil.CANVAS_WIDTH);
    $("#paintArea").attr("height", PaintUtil.CANVAS_HEIGHT);

    // 画像選択
    $('#selectImage').change(
        function () {
            let file = $('#selectImage')[0].files[0];
            let reader = new FileReader();
            reader.onload = function (evt) {
                PaintUtil.loadImageFile(file, function (loadImage) {
                    PaintUtil.ImgB64Resize(loadImage.toDataURL('image/png'), PaintUtil.CANVAS_WIDTH, PaintUtil.CANVAS_HEIGHT,
                        function (resizeImg) {
                            setCanvas(resizeImg);
                        }
                    );
                });
            }
            reader.readAsDataURL(file);
        }
    );

    function setCanvas(drawImage) {
        // パラメータ
        let stage;
        let bitmap;
        let shape;
        let oldPt;
        let oldMidPt;
        let allPoints = [];
        let points = [];
        let tempPoints = [];

        // stage初期化
        stage = new createjs.Stage("paintArea");
        stage.autoClear = true;
        stage.enableDOMEvents(true);

        // CreateJSタッチイベント有効化
        createjs.Touch.enable(stage);

        // 第1レイヤー：画像
        bitmap = new createjs.Bitmap(drawImage);
        stage.addChild(bitmap);

        // 第2レイヤー：シェイプ
        shape = new createjs.Shape();
        shape.cache(0, 0, PaintUtil.CANVAS_WIDTH, PaintUtil.CANVAS_HEIGHT);
        stage.addChild(shape);

        // イベントリスナー初期化
        stage.removeAllEventListeners();
        // stageマウスダウンイベント登録
        stage.addEventListener("stagemousedown", handleDown);

        stage.update();
        createjs.Ticker.timingMode = createjs.Ticker.RAF;
        createjs.Ticker.addEventListener("tick", onTick);

        // ←ボタン
        $('#undo').on('click', function () {
            $('#undo').off('click');
            $('#undo').on('click', undo());
        });
        // →ボタン
        $('#redo').on('click', function () {
            $('#redo').off('click');
            $('#redo').on('click', redo());
        });
        // クリアボタン
        $('#clear').on('click', function () {
            $('#clear').off('click');
            $('#clear').on('click', clear());
        });
        // 保存ボタン
        $('#save').on('click', function () {
            $('#save').off('click');
            $('#save').on('click', save());
        });

        function handleDown(event) {
            stage.addEventListener("stagemousemove", handleMove);
            stage.addEventListener("stagemouseup", handleUp);
            // 開始座標を保持
            oldPt = new createjs.Point(stage.mouseX, stage.mouseY);
            oldMidPt = oldPt.clone();
        }

        function handleMove(event) {
            let midPt = new createjs.Point(oldPt.x + stage.mouseX >> 1, oldPt.y + stage.mouseY >> 1);

            // カレント座標設定
            let point = {
                midPt_x: midPt.x,
                midPt_y: midPt.y,
                oldPt_x: oldPt.x,
                oldPt_y: oldPt.y,
                oldMidPt_x: oldMidPt.x,
                oldMidPt_y: oldMidPt.y,
                s_stroke: $('#thickness').val(),
                s_color: $('#color').val(),
                compositeOperation: $("#paintType").prop('checked') ? "destination-out" : "source-over",
            }
            points.push(point);

            // 座標描画
            drawLine(point);

            oldPt.x = stage.mouseX;
            oldPt.y = stage.mouseY;

            oldMidPt.x = midPt.x;
            oldMidPt.y = midPt.y;

            stage.update();
        }

        function handleUp(event) {
            // イベント解除
            stage.removeEventListener("stagemousemove", handleMove);
            stage.removeEventListener("stagemouseup", handleUp);

            // 描画座標の保存とカレント座標の初期化
            allPoints.push(points);
            points = [];

            tempPoints = [];
        }

        function drawLine(point) {
            shape.graphics.clear()
                .setStrokeStyle(point.s_stroke, 'round', 'round')
                .beginStroke(point.s_color)
                .moveTo(point.midPt_x, point.midPt_y)
                .curveTo(point.oldPt_x, point.oldPt_y, point.oldMidPt_x, point.oldMidPt_y);
            shape.updateCache(point.compositeOperation);
        }

        function reDrawAllLines() {
            for (let index1 in allPoints) {
                for (let index2 in allPoints[index1]) {
                    drawLine(allPoints[index1][index2]);
                }
            }
        }

        function undo() {
            if (allPoints.length > 0) {
                tempPoints.push(allPoints[allPoints.length - 1]);
                allPoints.pop();
                shape.graphics.clear();
                shape.updateCache()
                reDrawAllLines();
            }
        }

        function redo() {
            if (allPoints.length > 0
                && tempPoints.length > 0) {
                allPoints.push(tempPoints[tempPoints.length - 1]);
                tempPoints.pop();
                shape.graphics.clear();
                shape.updateCache()
                reDrawAllLines();
            }
        }

        function clear() {
            let result = confirm("描画を全消去します");
            if (result == true) {
                allPoints = [];
                tempPoints = [];
                shape.graphics.clear();
                shape.updateCache();
            }
        }

        function save() {
            let png = stage.canvas.toDataURL();
            let link = document.createElement('a');
            link.download = "paintedImage.png";
            link.href = png;
            link.click();   
        }

        function onTick() {
            // stageの描画を更新
            stage.update();
        }
    }
});

