# 后端 API 契约（当前实现）

根路径 `/api/v1`。请求、响应 JSON；金额为整数分，时间为 UTC Unix 秒。所有接口（登录和公开注册除外）必须发送 `Authorization: Bearer <JWT>`。旧 `token` 请求头和请求体中的 token 不再兼容，避免多种认证入口产生歧义。

响应统一 `{"success":true,"message":"","data":...}`；失败为 `success:false,data:null` 和安全的 message。HTTP 400 输入错误、401 未认证/令牌无效/账号封禁、403 无权、404 不存在、409 状态/库存/幂等/数据库冲突、405 不支持的方法、500 未预期错误。不会返回 SQL、堆栈、密码或哈希。

ID：资源 ID 为正 Long，用户 ID 为 1..32 位 ASCII 字母/数字/下划线，首位字母或下划线，**区分大小写**。新约定允许语言关键字，不再采用无法跨语言维护的保留字黑名单。密码 8..72 字符，且不超过 72 UTF-8 字节；旧账号登录允许短旧密码，改密必须遵守新规则。未知 JSON 字段、浮点数量会 400。

分页统一 `page=0,size=20`，page 0..1000000、size 1..100；没有 size=0 全量模式。列表返回 `data:{content:[],count,page,size}`，数据库分页；用户按 ID 升序，商品/订单按 ID 降序稳定排序。多个筛选条件使用 AND，权限范围始终参与查询。

## 账号

| 方法与路径 | 请求 | 权限/响应 data |
| --- | --- | --- |
| POST `/auth/register` | `{user,password}` | 公开创建普通用户，重复 ID 409；UserView |
| POST `/auth` | `{user,password}` | 登录；`{token,tokenType:"Bearer",expiresAt}` |
| GET `/auth` | 无 | 当前 UserView |
| POST `/auth/logout` | 无请求体 | 吊销当前 jti；null，随后使用该令牌 401 |
| POST `/auth/reset` | `{oldPassword,newPassword}` | 自己改密，所有旧会话立即失效，重新登录 |
| GET `/user` | page,size | 仅管理员；分页用户 ID 列表 |
| POST `/user` | `{user,password}` | 仅管理员创建普通用户；UserView |
| GET `/user/{id}` | 无 | 本人或管理员可看完整资料 |
| POST `/user/{id}` | `{nickname?,description?,address?}` | 本人或管理员；至少一项，不能含 role/password |
| POST `/user/{id}/role` | `{role:-1或0或1}` | 仅管理员管理其他用户，禁止修改自己 |
| POST `/user/{id}/ban` | 无 | 同上，设 -1，并吊销其全部会话 |

UserView 仅 `{id,nickname,description,address,role}`，role=-1 封禁/0 普通/1 管理。角色变化增加会话版本；解封也不会恢复旧令牌。nickname 1..64、description 0..255、address 1..255，昵称和地址不能纯空白。地址是单字符串，未实现多个地址簿对象。空 `{}` 不删除资源，返回 400。

## 商品/团购

| 方法与路径 | 请求 | 说明 |
| --- | --- | --- |
| GET `/item` | page,size,keyword?,owner?,status? | 名称/描述包含关键字，按发起人和状态共同筛选；分页 ItemView |
| GET `/item/{id}` | 无 | 任意已认证用户 |
| POST `/item` | `{name,description?,price,stock,status?,startTime?,endTime?}` | 发起人来自当前用户，返回 ItemView |
| POST `/item/{id}` | 上述可选字段及 `version?` | 仅发起人/管理员，至少一项业务变更 |

name 非空且不超过128，description 最多10000，price 0..2147483647，stock 同范围。免费商品合法。status **仅 -1 下架、0 上架**，不再编码发货次数。响应 `shipmentCount` 独立统计已执行的订单发货次数。

商品name/description、用户nickname/description及评价为纯文本，拒绝尖括号；前端用textContent显示。分页、整数及字符串长度不合法返回400。

startTime 默认服务端现在且 >=0；endTime 为 null 时无限，更新时 -1 表示清除截止时间，给定截止时间必须大于开始时间。购买窗口 `[startTime,endTime)`。

ItemView：`{id,name,description,price,stock,status,owner,startTime,endTime,shipmentCount,version}`。修改绝对剩余库存必须发送**最近一次读取的 version**；版本陈旧或缺失为409，前端刷新后重新决定库存。下单、回补、发货和商品更新都会更新版本。剩余库存加尚可取消的预留库存不得超出 INT 容量。下架不自动取消已存在订单。商品不物理删除，显式修改 `status:-1` 关闭销售。

## 订单

| 方法与路径 | 请求 | 说明 |
| --- | --- | --- |
| GET `/order` | page,size,user?,owner?,item?,status? | 买家/卖家只能查与自己有关的订单，管理员全局 |
| GET `/order/{id}` | 无 | 买家/卖家/管理员 |
| POST `/order` | `{itemId,quantity,address}` + `Idempotency-Key` 请求头 | 创建待支付订单；`item` 为 itemId 的兼容别名，不要同时发送两者 |
| POST `/order/{id}/pay` | 无请求体 | 仅买家模拟支付，待支付 → 待发货 |
| POST `/order/{id}/ship` | 无请求体 | 卖家/管理员，待发货 → 待收货 |
| POST `/order/{id}/receive` | 无请求体 | 买家/管理员，待收货 → 已完成 |
| POST `/order/{id}/cancel` | 无请求体 | 买家/管理员取消待支付；卖家/管理员取消待发货并模拟退款 |
| POST `/order/{id}/address` | `{address}` | 买家/管理员，只能待发货时改地址 |
| POST `/order/{id}` | `{address}` | 上一接口的兼容路径；禁止通用 status/时间更新 |

quantity 必须1..2147483647整数；address 非空白且最多255。买卖双方不能相同，买家/卖家不能封禁，商品必须可售且库存足够。卖家、买家、价格、total、状态、全部时间由后端确定，发送这些多余字段为400。

幂等键：1..64位字母、数字、下划线或短横线，按买家隔离，数据库唯一 `(user_id,idempotency_key)`。相同键及完全相同的 itemId、quantity、address 返回原订单的**当前结果**（包括已取消）；不同参数409。键在交易保留期内不删除，重试不再次扣库存。一个新购买意图应使用新键。

OrderView：`{id,itemId,user,owner,quantity,price,total,address,status,createTime,payTime,shipTime,receiptTime,closeTime,expiresAt,refundStatus}`。单价和total是下单快照；total 为64位整数。未付款时，卖家的响应 address 为null；买家和管理员可看。支付后卖家取得履约地址，其他用户不能查看订单。卖家不会取得买家的用户资料地址。

状态：0待支付、1待发货、2待收货、3完成、-1取消。唯一正常链为 `0→1→2→3`；允许 `0→-1` 和 `1→-1`（后一种由卖家/管理员操作，`refundStatus=SIMULATED_REFUNDED`），其余拒绝。支付/发货/收货在其目标状态重复请求返回原结果；取消在-1重复返回原结果；跨越后续状态的旧动作409。每次仍检查操作者，不能用重复动作绕过权限。

创建时间、截止时间、支付/发货/收货/关闭时间全部由后端写入。到截止秒即禁止支付，定时任务关闭并只回补一次；管理员也不能强行支付。已发货不支持取消。完成及取消的记录保留，未提供删除端点。

## 平台统计

`GET /stats` 仅管理员。data 为 `{userCount,itemCount,orderCount,totalRevenue,ongoingItemCount}`。交易额口径：状态1/2/3订单的 total 总和，含已付款未完成，排除未支付、取消及模拟退款。不是平台利润/抽佣。进行中团购要求上架且 `start<=now<end`（end无限除外），不按发货次数判断。

## 前端必须适配的差异

1. 所有 token 改为 Bearer 请求头，401清理登录态；登录从 `data.token` 取令牌。响应统一取 data，不能再读顶层 item/order/items/count/token。
2. 商品/订单创建返回完整 DTO，ID 分别为 `data.id`；列表是 `data.content` 对象数组，用户列表是字符串数组。订单输出字段统一 itemId（输入兼容 item）；价格从商品展示，不能提交买家/卖家/价格。
3. 更新商品库存发送 version。status 的正数旧含义移到 shipmentCount，展示发货计数应读新字段。
4. 下单生成并保存 Idempotency-Key，网络重试沿用。支付/发货/收货/取消调用显式操作路径；地址更新仅发送 address。
5. 不再使用空请求隐式删除；不提供订单/账号/商品物理删除。封禁和下架分别调用显式接口。size=0 调用需改为分页。
6. 本次不重写前端；旧前端需完成这些改动才能联调。

## 企业增量：阶段3商品快照

OrderView新增itemName、itemDescription、snapshotSource（AT_CREATION/LEGACY_UNKNOWN）。新订单保存创建时名称/描述，不随商品修改或下架变化；旧订单没有这类历史记录，返回null和LEGACY_UNKNOWN，禁止前端将当前商品名当成交快照。旧字段与路径保留，幂等重试仍返回同一订单当前结果。

## 企业增量：分类、购物车和拆单

- `GET /categories?page&size`：分页分类；`POST /categories {name}`仅ADMIN；`PUT /item/{id}/category {categoryId}`仅发起人/ADMIN。商品列表新增category条件，与keyword/owner/status共同生效，ItemView新增categoryId。
- `GET /cart`：仅当前用户，返回`{version,lines:[{itemId,quantity,selected,name,price,stock,status,startTime,endTime}]}`。最多50种商品。
- `PUT /cart/{itemId} {quantity,selected}`：增/改（数量为正INT）；`DELETE /cart/{itemId}`：显式删除自己的购物车行，重复删除幂等。买家身份不能通过请求指定。
- `POST /checkout`：Bearer与Idempotency-Key，体`{address,cartVersion,expectedTotal?}`。结算全部已勾选行，cartVersion必须来自GET；expectedTotal用于确认价格变化，实际金额始终读取数据库，不一致409。
- 一次结算按卖家生成一个订单，每单有多商品明细，同一事务全部成功或全部失败。只在成功时删除已勾选行并增加购物车version。相同键/同参数重试返回原批次，不受成功后购物车清空影响；改参数409。重试必须沿用原cartVersion；新购买意图使用新键并刷新购物车。
- 返回`{id,total,orders:[{order:OrderView,lines:[{itemId,quantity,price,total,itemName,itemDescription,snapshotSource}]}]}`。`GET /checkout/{id}`仅买家/ADMIN，卖家不能看整个跨卖家批次。`GET /order/{id}/details`按原订单参与人规则读取一张订单及明细。
- 兼容旧单商品入口`POST /order`，也会写一条明细。多商品订单的主表itemId/price/itemName为第一明细的兼容摘要，quantity为数量合计、total为明细金额总和；**前端对多商品单必须展示lines，不得用price*quantity推算总额**。所有操作和item筛选覆盖全部明细，非主商品也可查询到订单。

## 企业增量：模拟支付、退款、评价与内部结算

本节是隔离SIMULATOR契约，**不是任何真实支付平台沙箱验收**。正式deploy配置禁用模拟渠道。全站金额为整数分：单笔/批次Long边界精确检查，平台跨订单聚合使用BigInteger避免Long溢出。前端涉及大金额应使用能保留整数精度的JSON解析/BigInt方案，不能用JS浮点Number计算账务。

| 路径 | 权限与规则 |
| --- | --- |
| POST `/payments {orderId}` | 仅买家，创建或返回同订单唯一PENDING记录；价格、商户、金额由服务端决定 |
| GET `/payments/{id}` | 买家/卖家/ADMIN；返回id/orderId/amount/merchant/channel/status/providerReference/服务端时间 |
| POST `/payments/{id}/simulate` | 仅买家，后端调用模拟渠道并完成合法状态转移，客户端不指定成功或时间 |
| POST `/payments/{id}/query` | 参与人/ADMIN主动查询模拟渠道持久记录，校验金额/商户后补偿遗漏通知 |
| POST `/order/{id}/refunds {reason}` | 仅买家；每单一次全额申请，同原因重试返回原申请，冲突原因409 |
| GET `/refunds/{id}` | 参与人/ADMIN，包含状态、金额、attempts和服务端时间 |
| POST `/refunds/{id}/approve`、`/reject` | 卖家/ADMIN审核，不能由买家批准；批准后发起渠道退款 |
| POST `/refunds/{id}/retry` | 卖家/ADMIN重试FAILED，沿用同退款ID作为渠道幂等键，不新建退款 |
| POST `/order/{id}/reviews {itemId,rating,comment}` | 仅买家，已完成且未退款/争议；每订单每商品一条，rating1..5、comment最多1000且纯文本 |
| GET `/item/{id}/reviews?page&size` | 已认证用户，稳定分页，不含地址等私密字段 |
| POST `/settlements {seller?}` + Idempotency-Key | 卖家结算自己，ADMIN可选seller；同卖家同键返回原批次 |
| GET `/settlements/{id}` | 对应卖家/ADMIN；批次netAmount与逐笔SALE/REFUND明细 |

兼容`POST /order/{id}/pay`，也会创建独立支付记录。所有真实资金动作均不存在；渠道名必须显示SIMULATOR。模拟渠道记录持久化于专用表，不使用仅进程内Map冒充重启后查询。失败支付仍保留原状态，客户端以订单/支付status判断结果。

退款状态REQUESTED→REJECTED或APPROVED→SUCCEEDED/FAILED；FAILED可重试，通知可补偿已批准结果。拒绝后本版不支持重新提交新申请，不支持部分金额退款或真实退货物流。全额成功后订单关闭为-1，refundedTotal记实退。待发货退款才回补全部明细库存；已发货/完成的售后不自动回补，避免把未回仓货物再次出售。申请/失败处理中暂停发货/收货；重复批准/通知不再回补或记账。

旧卖家取消已支付待发货订单会生成并执行一条全额模拟退款；失败保留原订单并从退款接口重试。历史已支付订单如果缺支付记录，拒绝自动退款/结算，需人工对账，不能迁移时伪造支付凭据。

内部结算仅处理已完成、未退款、无处理中售后且有成功支付记录的订单，不代表银行打款。每订单SALE唯一；已结算后退款生成唯一负数REFUND调整，下一批可能为负，表示应扣回账款。退款与结算共享数据库账务锁，所有相关路径先取得账务锁再取得商品/订单/外键隐式锁。每次最多纳入100张新订单/200条待结算明细；超过Long批次净额容量时保留剩余到下一批，不截断溢出。

评价与直接下单/购物车结算统一按当前用户→商品ID升序→订单取得锁；评价插入的用户外键检查不能反向等待用户锁。评价入口在事务内复查用户未封禁。此并发修复不改变请求、响应或前端契约；finance_mutex保持原账务顺序。

统计保留totalRevenue为状态1/2/3订单总额，新增grossPaidAmount（成功支付累计）、refundAmount（成功退款累计）、netPaidAmount（前两者之差）及unreconciledPaidOrderCount（缺支付凭据的历史已付订单数）。这些不是利润或抽佣，内部结算不改变平台支付净额。

### 模拟渠道通知（无需用户Bearer，但必须有效签名）

`POST /payments/simulator/notify`、`POST /refunds/simulator/notify`只在显式启用模拟模式时注册。JSON为`{id,eventId,amount,merchant,status}`，status=SUCCEEDED或FAILED；头`X-Channel-Signature`为64位小写hex HMAC-SHA256。签名原文按字段规范化为`id|eventId|amount|merchant|status`，密钥为独立PAYMENT_SIM_SECRET的Base64解码随机字节，不能复用真实平台凭据。

先验签，再校验本地记录的商户/金额、批准状态与事件唯一性。同eventId相同参数重复确认，冲突409。支付和退款各自事件空间独立。过期/已取消未支付订单收到成功通知返回409待对账，不能复活订单；本版没有真实晚到资金自动退回能力，接真实渠道前必须实现相应补偿。没有外部凭据，因此不声称真实渠道通知/网络故障已验收。

## 可靠性新增契约

响应在原success/message/data之外增加code（成功OK）和32位traceId，响应头X-Trace-Id一致；客户端不要提交身份/状态/服务端时间。429为RATE_LIMITED并带Retry-After。CORS允许源必须环境明确列出，默认不开放，Bearer不使用Cookie。

ADMIN `GET /audit?page=0&size=20`：分页`{id,createTime,traceId,actorHash,action,resourceHash,outcome,httpStatus}`，哈希字段不是明文账号或地址。Actuator独立沿用标准响应而非Api envelope，全部要求ADMIN；自动OpenAPI也为标准OpenAPI格式。失败CORS预检由框架403拒绝，不含业务对象。监控与限制见[运行说明](operations.md)。

前端增量适配：购物车保留version并按卖家展示checkout返回的orders/lines；幂等重试沿用原cartVersion和幂等键。支付页显示SIMULATOR且查询独立支付记录，不由客户端提交成功标志；售后和结算分别展示独立记录、FAILED重试及负数调整。大金额使用保留整数精度的JSON解析，不能用Number累加超过2^53的账务。401重新登录、409刷新业务数据、429按Retry-After重试，排障向维护者提供traceId；不展示服务器内部异常。


## 卖家售后收件箱（2026-10-27）

所有路径均以 `/api/v1` 为前缀，使用现有 Bearer 认证和 Api 返回结构。本次为追加接口，无数据库迁移，不修改已有申请/审核/资金与库存规则。

### GET `/refunds`

分页发现售后申请，卖家无需向买家索取编号。

| 参数 | 类型与默认值 | 说明 |
| --- | --- | --- |
| scope | seller（默认）/buyer/all | seller只查当前账号销售订单，buyer只查当前账号购买订单，all仅ADMIN可用。ADMIN默认仍是seller，查看全局需显式all。 |
| status | 可选字符串 | REQUESTED、APPROVED、FAILED、SUCCEEDED、REJECTED；省略表示全部状态。 |
| orderId | 可选正Long | 在当前权限范围内按订单过滤，不能绕过scope。 |
| page | 0..1000000，默认0 | 页号。 |
| size | 1..100，默认20 | 每页数量。 |

`data={content,count,page,size}`；content每项为 `{id,orderId,buyer,seller,amount,reason,status,attempts,createTime,updateTime}`。金额单位分，时间单位秒，订单ID与金额保持Long精度。按createTime倒序、id倒序稳定排序，count为相同过滤范围的总数。列表不返回地址、支付渠道密钥或用户资料。身份取自认证上下文，user/owner/seller账号参数不能扩大范围。count与本页在同一只读快照中查询。

例：`GET /refunds?status=REQUESTED&page=0&size=20`列出自己的待审核申请；读取content中的id后，调用现有`GET /refunds/{id}`、`POST /refunds/{id}/approve|reject|retry`。

### GET `/order/{id}/refunds`

买家、对应卖家或ADMIN按订单读取现有完整Refund对象（与`GET /refunds/{id}`一致）。有权访问且尚未申请时返回HTTP200、`success=true,data=null`；无权访问仍返回403，订单不存在404，非法ID400，未登录401。不要将无申请当作服务错误。

前端销售订单详情据此显示查看/处理售后入口，卖家工作台通过列表展示待处理申请；不再依赖买家传递UUID。申请状态来自退款表，不能用订单refundStatus的NONE/SIMULATED_REFUNDED判断是否REQUESTED。当前无WebSocket/消息推送，刷新列表或进入工作台即可获取持久化的新申请。
