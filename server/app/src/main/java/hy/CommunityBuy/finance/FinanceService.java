package hy.CommunityBuy.finance;

import hy.CommunityBuy.dto.Dtos.PageView;
import hy.CommunityBuy.exception.BusinessException;
import hy.CommunityBuy.finance.FinanceDtos.*;
import hy.CommunityBuy.security.Actor;
import hy.CommunityBuy.service.OrderService;
import java.time.Clock;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@RequiredArgsConstructor
public class FinanceService {
  private final FinanceBook book;
  private final OrderService orders;
  private final JdbcTemplate jdbc;
  private final Clock clock;

  public Payment start(Actor a, long orderId) {
    return orders.preparePayment(a, orderId);
  }

  @Transactional(readOnly = true)
  public Payment get(Actor a, String id) {
    var p = book.payment(id);
    orders.get(a, p.orderId());
    return p;
  }

  public Payment simulate(Actor a, String id) {
    var p = get(a, id);
    orders.action(a, p.orderId(), "pay");
    return get(a, id);
  }

  public Payment query(Actor a, String id) {
    return orders.queryPayment(a, id);
  }

  @Transactional(readOnly = true)
  public Refund refund(Actor a, String id) {
    var r = book.refund(id);
    orders.get(a, r.orderId());
    return r;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public PageView<RefundEntry> refunds(
      Actor a, String scope, String status, Long orderId, int page, int size) {
    var conditions = new ArrayList<String>();
    var parameters = new ArrayList<Object>();
    // Scope always comes from the authenticated actor, never a caller-supplied account ID.
    switch (scope) {
      case "seller" -> {
        conditions.add("o.owner_id=?");
        parameters.add(a.id());
      }
      case "buyer" -> {
        conditions.add("o.user_id=?");
        parameters.add(a.id());
      }
      case "all" -> a.requireAdmin();
      default -> throw BusinessException.bad("Invalid refund scope");
    }
    if (status != null) {
      if (!Set.of("REQUESTED", "APPROVED", "FAILED", "SUCCEEDED", "REJECTED").contains(status))
        throw BusinessException.bad("Invalid refund status");
      conditions.add("r.status=?");
      parameters.add(status);
    }
    if (orderId != null) {
      conditions.add("r.order_id=?");
      parameters.add(orderId);
    }
    String from = " from refunds r join orders o on o.id=r.order_id";
    if (!conditions.isEmpty()) from += " where " + String.join(" and ", conditions);
    long count = jdbc.queryForObject("select count(*)" + from, Long.class, parameters.toArray());
    parameters.add(size);
    parameters.add((long) page * size);
    var content =
        jdbc.query(
            "select r.*,o.user_id as buyer,o.owner_id as seller"
                + from
                + " order by r.create_time desc,r.id desc limit ? offset ?",
            (rs, n) ->
                new RefundEntry(
                    rs.getString("id"),
                    rs.getLong("order_id"),
                    rs.getString("buyer"),
                    rs.getString("seller"),
                    rs.getLong("amount"),
                    rs.getString("reason"),
                    rs.getString("status"),
                    rs.getInt("attempts"),
                    rs.getLong("create_time"),
                    rs.getLong("update_time")),
            parameters.toArray());
    return new PageView<>(content, count, page, size);
  }

  @Transactional(readOnly = true)
  public Refund refundForOrder(Actor a, long orderId) {
    // Check the order even when no refund exists, so absence cannot bypass ownership checks.
    orders.get(a, orderId);
    var ids = jdbc.queryForList("select id from refunds where order_id=?", String.class, orderId);
    return ids.isEmpty() ? null : book.refund(ids.getFirst());
  }

  public Refund request(Actor a, long orderId, String reason) {
    return orders.refundOperation(a, orderId, "request", reason);
  }

  public Refund review(Actor a, String id, String operation) {
    var r = refund(a, id);
    return orders.refundOperation(a, r.orderId(), operation, null);
  }

  @Transactional(readOnly = true)
  public PageView<Review> reviews(long itemId, int page, int size) {
    return new PageView<>(
        jdbc.query(
            "select * from reviews where item_id=? order by id desc limit ? offset ?",
            (rs, n) ->
                new Review(
                    rs.getLong("id"),
                    rs.getLong("order_id"),
                    rs.getLong("item_id"),
                    rs.getString("user_id"),
                    rs.getInt("rating"),
                    rs.getString("comment"),
                    rs.getLong("create_time")),
            itemId,
            size,
            page * size),
        jdbc.queryForObject("select count(*) from reviews where item_id=?", Long.class, itemId),
        page,
        size);
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  @hy.CommunityBuy.infrastructure.BusinessAudit("SETTLEMENT")
  public Settlement settle(Actor a, String seller, String key) {
    a.requireSelf(seller);
    book.lockLedger();
    var old =
        jdbc.queryForList(
            "select id from settlement_batches where seller_id=? and idempotency_key=?",
            String.class,
            seller,
            key);
    if (!old.isEmpty()) return settlement(a, old.getFirst());
    // All refund/cancel/settlement paths take this mutex first; FK checks may implicitly lock
    // referenced rows.
    var eligible =
        jdbc.queryForList(
            "select o.id,o.total from orders o join payments p on p.order_id=o.id and"
                + " p.status='SUCCEEDED' where o.owner_id=? and o.status=3 and o.refunded_total=0"
                + " and not exists(select 1 from refunds r where r.order_id=o.id and r.status"
                + " in('REQUESTED','APPROVED','FAILED')) and not exists(select 1 from"
                + " settlement_entries e where e.order_id=o.id and e.kind='SALE') order by o.id"
                + " limit 100",
            seller);
    for (var row : eligible)
      jdbc.update(
          "insert into settlement_entries(seller_id,order_id,kind,amount) values (?,?,'SALE',?)",
          seller,
          row.get("id"),
          row.get("total"));
    var pending =
        jdbc.queryForList(
            "select id,amount from settlement_entries where seller_id=? and batch_id is null order"
                + " by id limit 200",
            seller);
    if (pending.isEmpty()) throw BusinessException.conflict("No eligible settlement entries");
    long net = 0;
    var chosen = new ArrayList<Map<String, Object>>();
    for (var row : pending) {
      try {
        net = Math.addExact(net, ((Number) row.get("amount")).longValue());
        chosen.add(row);
      } catch (ArithmeticException capacity) {
        break;
      } // Persist the remaining entries for the next batch; never wrap.
    }
    String id = UUID.randomUUID().toString();
    jdbc.update(
        "insert into settlement_batches(id,seller_id,idempotency_key,net_amount,create_time) values"
            + " (?,?,?,?,?)",
        id,
        seller,
        key,
        net,
        clock.instant().getEpochSecond());
    for (var row : chosen)
      jdbc.update(
          "update settlement_entries set batch_id=? where id=? and batch_id is null",
          id,
          row.get("id"));
    return settlement(a, id);
  }

  @Transactional(readOnly = true)
  public Settlement settlement(Actor a, String id) {
    var rows = jdbc.queryForList("select * from settlement_batches where id=?", id);
    if (rows.isEmpty()) throw BusinessException.missing();
    var row = rows.getFirst();
    a.requireSelf(row.get("seller_id").toString());
    var entries =
        jdbc.query(
            "select * from settlement_entries where batch_id=? order by id",
            (rs, n) ->
                new Entry(
                    rs.getLong("id"),
                    rs.getLong("order_id"),
                    rs.getString("refund_id"),
                    rs.getString("kind"),
                    rs.getLong("amount")),
            id);
    return new Settlement(
        id,
        row.get("seller_id").toString(),
        ((Number) row.get("net_amount")).longValue(),
        ((Number) row.get("create_time")).longValue(),
        entries);
  }
}
