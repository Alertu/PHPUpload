/**
 * 生成webUploader上传控件 #需要配合webuploader的js库使用
 *
 * @param object opts 配置信息
 */
function createWebupload(opts = {}) {
    let option = Object.assign({}, {
            cusIsPs: false,//自定义
            auto: true,// 选完文件后，是否自动上传。
            runtimeOrder: "html5",
            server: '/wap/ajax/upload',// 文件接收服务端。
            pick: '',// 内部根据当前运行是创建，可能是input元素，也可能是flash. 这里是div的id
            chunked: false,//开起分片上传。
            chunkSize: 1024 * 1024 * 2,//默认切片大小
            chunkRetry: 3,//如果某个分片由于网络问题出错，允许自动重传多少次
            threads: 8, // 上传并发数。允许同时最大上传进程数。
            method: 'POST', // 文件上传方式，POST或者GET。
            fileSizeLimit: 1024 * 1024, //验证文件总大小是否超出限制, 超出则不允许加入队列。
            fileSingleSizeLimit: 1024 * 1024, //验证单个文件大小是否超出限制, 超出则不允许加入队列。
            fileVal: 'file', // [默认值：'file'] 设置文件上传域的name。
            duplicate: true, //允许文件多次上传
        }, opts || {}),
        uploader = WebUploader.create(option || {});

    //当文件上传成功时触发
    uploader.on('uploadSuccess', function (file, response) {
        layer.msg(response.msg);

        if (response.code == 1) {
            let tpl = $("#" + option.tag + "_template").html(), tplData = {id: file.id, src: response.data.url};
            tpl = tpl.replace(/\$\{(.*?)\}/ig, function (match, $1) {
                return tplData[$1];
            });

            $('div.div_' + option.tag + '>div:last').before(tpl);
        }
    });

    //上传过程中触发，携带上传进度
    uploader.on('uploadProgress', function (file, percentage) {
        let p = parseInt(percentage * 100);
        if (!option.cusIsPs) {
            //页面层-自定义
            layer.open({
                type: 1,
                title: false,
                closeBtn: false,
                skin: 'yourclass',
                content: `<div id="show_upload_progress" style="font-size: 0.28rem;color:#fff;display:flex;flex-direction:column;justify-content: center;align-items: center;"><img src="__WAP__/js/layer/theme/default/loading-0.gif" style="width:60px;height:24px;display:flex;" /><p>上传中……</p></div>`
            });
            option.cusIsPs = true
        } else {
            $("#show_upload_progress p").html('上传进度 ' + p + '%');
            if (p >= 99) layer.closeAll();
        }
    });

    uploader.on('uploadComplete', function (file, percentage) {
        option.cusIsPs = true;//重置选项
    });

    //当validate不通过时，会以派送错误事件的形式通知调用者
    uploader.on('error', function (type) {
        switch (type) {
            case 'Q_TYPE_DENIED':
                layer.msg('文件类型不支持');
                break;

            case 'Q_EXCEED_SIZE_LIMIT':
                layer.msg('文件大小超出限制' + WebUploader.formatSize(option.fileSingleSizeLimit));
                break;

            case 'Q_EXCEED_NUM_LIMIT':
                layer.msg('文件数量超出限制' + option.fileNumLimit + '个');
                break;

            default:
                layer.msg("上传出错，请检查后重新上传！错误码" + type);
        }
    });

    return uploader;
}

/**
 * 生成自定义上传控件
 *
 * @param curr
 * @param tag
 */
function makeInputFile(curr, tag) {
    //规则-是否数量超出
    if (/video/i.test(tag)) {
        if (document.querySelectorAll("#video .div_video").length >= videoCount) {
            layer.msg('一次最多上传' + videoCount + '个视频');
            return false;
        }
    }

    //创建控件
    var input = document.createElement('input');
    input.type = 'file';
    input.name = tag + '[]';
    input.style.display = 'none';
    input.click();

    //预览
    input.addEventListener('change', function () {
        if ((this.files[0].size / 1024 / 1024).toFixed(2) > 5) {
            layer.msg('上传资源大小超出5MB');
            return false;
        }

        if (this.files.length) {
            if (tag == 'video') {
                var temp = document.querySelector('#videoTemplate').innerHTML;
                temp = temp.replace(/\$\{src\}/ig, window.URL.createObjectURL(this.files[0]));
                document.querySelector('#' + tag).insertAdjacentHTML('beforeend', temp);
            } else {
                var image = document.createElement('img');
                image.src = window.URL.createObjectURL(this.files[0]);
                image.style = "height:1.5rem";
                document.querySelector('.div_' + tag).append(image);
            }
        }

        document.querySelector('.div_' + tag).append(input);
    });
}

/**
 * 微信JS-SDK上传
 * @param loadfiles
 * @returns {boolean}
 */
function newOss(loadfiles){
    //主要为了填充页面
    var tag='photo';
    //控制加载中显示与隐藏
    var cusIsPs=false;
    //可上传的文件类型
    var mimetype='jpg|jpeg|png|JPEG|PNG';
    let file = loadfiles,
        //验证上传的图片是否符合规则
        res = (new RegExp('\.(' + mimetype + ')$', 'i')).exec(file.name),
        suffix = '';
    console.log('file.name',file.name)
    console.log('ossreds',res)
    try {
        if (!res) throw new Error('上传文件格式支持 ' + mimetype);
        //验证上传的图片大小是否符合规则
        if ((file.size / 1024 / 1024).toFixed(2) > (1024 * 1024 * 2)) throw new Error('上传资源大小超出' + (1024 * 1024 * 2) + 'MB');
    } catch (e) {
        layer.msg(e.message || '验证文件异常');
        return false;
    }
    //获取到文件后缀
    suffix = res[1];//文件后缀

    //文件新名字
    let lindex = layer.load(),
        //重新定义图片的名字
        storeAs = 'luxi/uploads/' + Math.floor(Math.random() * 99999 + 1) + (new Date()).getTime() + '.' + suffix;
    //请求的目的是请求获取OSS配置
    //主要配置如下：
    /*$config = [
        'accessId' => $config['AccessKeyId'],
        'accessSecret' => $config['AccessKeySecret'],
        'bucket' => $config['bucket'],
        'endpoint' => $config['endpoint'],
        'stsToken' => $config['SecurityToken'],
        ];*/
    OSS.urllib.request(window.location.host + "getOssSts", {method: 'POST'}, async (err, response) => {
        lindex && layer.load(lindex);
        try {
            if (err) throw new Error('上传错误');
            result = JSON.parse(response);
        } catch (e) {
            layer.msg(response.message || '请求数据格式错误：' + e.message);
            return false;
        }

        //注入OSS配置信息
        let client = new OSS({
            accessKeyId: result.data.accessId,
            accessKeySecret: result.data.accessSecret,
            stsToken: result.data.stsToken,
            region: result.data.endpoint,
            bucket: result.data.bucket,
        });
        //文件在OSS.js中主要是上传
        //参数包括：文件名称/文件流文件
        //主要目的：上传到OSS
        let uploadRes = await client.multipartUpload(storeAs, file, {
            progress: function (p, checkpoint) {
                let point = parseInt(p * 100);
                if (point < 99 && !cusIsPs) {
                    //页面层-自定义
                    layer.open({
                        type: 1,
                        title: false,
                        closeBtn: false,
                        skin: 'yourclass',
                        content: `<div id="show_upload_progress" style="font-size: 0.28rem;color:#fff;display:flex;flex-direction:column;justify-content: center;align-items: center;"><img src="/dj/wap/js/layer/theme/default/loading-0.gif" style="width:60px;height:24px;display:flex;" /><p>上传中……</p></div>`
                    });
                    cusIsPs = true
                } else {
                    $("#show_upload_progress p").html('上传进度 ' + point + '%');
                    if (point >= 99) layer.closeAll();
                }
            },
            partSize: 1024 * 1024 * 5,//分片大小为1Mb
        });
        //正确
        //上传返回正确
        if (uploadRes.res.status == 200 && uploadRes.res.statusCode == 200) {
            //截取返回的内容
            var url = uploadRes.res.requestUrls[0].replace(/\?uploadId.*$/i, '');
            //填充模板
            var   tpl = getPreviewTemplate(tag);
            var tplData = {id: 'oss', src: url};
            tpl = tpl.replace(/\$\{(.*?)\}/ig, function (match, $1) {
                return tplData[$1];
            });
            $('div.div_' + tag + '>div:last').before(tpl);
        } else {
            layer.msg('上传失败，请重试');
        }
        cusIsPs = false;
    });
}

/**
 * 生成oss上传控件 #需要配合oss的js库使用
 * 参数用法与newOSS一致请参考
 * @param tag
 * @param opts
 */
function ossUpload(tag, opts = {}) {
    let option = $.extend(true, {
        inputAttrs: {},
        mimetype: 'png|jpg|mp4',
        singleFileSize: 1024 * 1024 * 2,//单个文件大小
        cusIsPs: false,
    }, opts || {});

    //创建控件
    var input = document.createElement('input');
    input.type = 'file';
    input.name = tag + '[]';
    input.style = 'opacity:0; width:100%; height:100%; z-index:2; position:absolute; top:0; left:0;';
    for (let key in option.inputAttrs) input.setAttribute(key, option.inputAttrs[key]);
    //input.click();
    document.querySelector('.div_btn_' + tag).append(input);

    input.addEventListener('change', function (e) {
        let files = e.target.files;
        for (let i = 0; i < files.length; i++) {
            let file = files[i],
                res = (new RegExp('\.(' + option.mimetype + ')$', 'i')).exec(file.name),
                suffix = '';
            try {
                if (typeof option.funValid === 'function') {
                    if (option.funValid.call(this, files, file) === false) return false;
                }
                if (!res) throw new Error('上传文件格式支持 ' + option.mimetype);
                if ((file.size / 1024 / 1024).toFixed(2) > option.singleFileSize) throw new Error('上传资源大小超出' + option.singleFileSize + 'MB');
            } catch (e) {
                layer.msg(e.message || '验证文件异常');
                return false;
            }
            suffix = res[1];//文件后缀

            //文件新名字
            let lindex = layer.load(),
                storeAs = 'luxi/uploads/' + Math.floor(Math.random() * 99999 + 1) + (new Date()).getTime() + '.' + suffix;
            OSS.urllib.request(window.location.host + "/wap/ajax/getOssSts", {method: 'POST'}, async (err, response) => {
                lindex && layer.load(lindex);
                try {
                    if (err) throw new Error('上传错误');
                    result = JSON.parse(response);
                } catch (e) {
                    layer.msg(response.message || '请求数据格式错误：' + e.message);
                    return false;
                }

                let client = new OSS({
                    accessKeyId: result.data.accessId,
                    accessKeySecret: result.data.accessSecret,
                    stsToken: result.data.stsToken,
                    region: result.data.endpoint,
                    bucket: result.data.bucket,
                });
                let uploadRes = await client.multipartUpload(storeAs, file, {
                    progress: function (p, checkpoint) {
                        let point = parseInt(p * 100);
                        if (point < 99 && !option.cusIsPs) {
                            //页面层-自定义
                            layer.open({
                                type: 1,
                                title: false,
                                closeBtn: false,
                                skin: 'yourclass',
                                content: `<div id="show_upload_progress" style="font-size: 0.28rem;color:#fff;display:flex;flex-direction:column;justify-content: center;align-items: center;"><img src="/dj/wap/js/layer/theme/default/loading-0.gif" style="width:60px;height:24px;display:flex;" /><p>上传中……</p></div>`
                            });
                            option.cusIsPs = true
                        } else {
                            $("#show_upload_progress p").html('上传进度 ' + point + '%');
                            if (point >= 99) layer.closeAll();
                        }
                    },
                    partSize: 1024 * 1024 * 5,//分片大小为1Mb
                });
                //正确
                if (uploadRes.res.status == 200 && uploadRes.res.statusCode == 200) {
                    var url = uploadRes.res.requestUrls[0].replace(/\?uploadId.*$/i, ''),
                        tpl = getPreviewTemplate(tag), tplData = {id: 'oss', src: url};
                    tpl = tpl.replace(/\$\{(.*?)\}/ig, function (match, $1) {
                        return tplData[$1];
                    });
                    $('div.div_' + tag + '>div:last').before(tpl);
                } else {
                    layer.msg('上传失败，请重试');
                }
                input.value = '';
                option.cusIsPs = false;
            });
        }
    });
}

/**
 * 获取预留模板
 *
 * @param tag
 * @param opts
 * @returns {*}
 */
function getPreviewTemplate(tag, opts = {}) {
    let option = $.extend(true, {
        'video': '<div class="div_video_item" style="position:relative;">\n' +
            '        <video src="${src}" controls></video>\n' +
            '        <div class="lookimg_delBtn" data-id="${id}" style="display: block;width: 1rem;right: 0;top: 0;left: initial;">\n' +
            '            移除\n' +
            '        </div>\n' +
            '        <input type="hidden" name="video[video][]" value="${src}">\n' +
            '    </div>',
        'photo': '<div class="lookimg div_photo_item" num="0">\n' +
            '        <img src="${src}"/>\n' +
            '        <div class="lookimg_delBtn" data-id="${id}">移除</div>\n' +
            '        <input type="hidden" name="photo[photo][]" value="${src}">\n' +
            '    </div>',
    }, opts || {});

    return option[tag];
}