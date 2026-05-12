ConstWebSocket=需要('WS');
ConstFS=需要('fs');
const路径=需要('路径');

Const港口=3000;
Constmessage_FILE=路径.参加(__目录名, 'messages.json');
ConstDary_PUBLIC_FILE=路径.参加(__目录名, 'diary_public.json');
Constprivate_DIARY_DIR=路径.参加(__目录名, 'private_diaries');

如果 (!FS.existsSync(private_DIARY_DIR)) FS.mkdirSync(private_DIARY_DIR, { 递归的：正确 });

功能 loadJSON(文件, 回退=[]) {
    尝试 {
        如果 (FS.existsSync(文件)) 返回 JSON.解析(FS.readFileSync(文件, 'utf8'));
    } 赶上 (e) {}
    返回 回退;
}
功能 saveJSON(文件, 数据) {
    FS.writeFileSync(文件, JSON.使字符串化(数据, null, 2), 'utf8');
}

// 广播消息
功能 broadcastAll(数据) {
    WSS.客户.foreach(客户=>{
        如果 (客户.readyState===WebSocket.打开) 客户.发送(数据);
    });
}

功能 loadPrivateDiary(用户名) {
    Const文件=路径.参加(private_DIARY_DIR, `${用户名}.json')；
返回loadJSON(文件)；
}
功能savePrivateDiary(用户名，条目){
Const文件=路径.参加(private_DIARY_DIR，'${用户名}..json')；'JSON；
saveJSON(文件，条目)；
}

ConstWSS=新的WebSocket。服务器({港口：港口})；
控制台.日志('WebSocket任务在ws://localhost：${港口}‘)；港口}‘)；

WSS.在……之上('连接'，WS=>{{
WS.在……上面('消息'，生的=>{
让msg；
尝试{味精=JSON.解析(生的)；}赶上(e){返回；}
        // 这里可以扩展消息类型
如果(味精.类型==='聊天'){
//存储到messages.json
Const消息=loadJSON(message_FILE)；
消息.推({发件人：味精.发件人，文本：味精.文本，时间：新的日期().toISOString()})；
如果 (消息.长度>200) 消息.转变(); //保留最近200条
saveJSON(message_FILE，消息)；
            // 广播给所有人
broadcastAll(JSON.使字符串化({类型：'聊天'，发件人：味精.发件人，文本：味精.文本}))；
} 其他 如果 (味精.类型==='获取历史记录') {
Const消息=loadJSON(message_FILE)；
WS.发送(JSON.使字符串化({类型：'历史记录'，消息}))；
}
});
});
