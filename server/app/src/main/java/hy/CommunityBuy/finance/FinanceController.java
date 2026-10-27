package hy.CommunityBuy.finance;

import hy.CommunityBuy.dto.*;
import hy.CommunityBuy.dto.Dtos.PageView;
import hy.CommunityBuy.finance.FinanceDtos.*;
import hy.CommunityBuy.security.Actor;
import hy.CommunityBuy.service.OrderService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Validated
public class FinanceController {
  private final FinanceService finance;
  private final OrderService orders;

  @PostMapping("/payments")
  public Api<Payment> start(@Valid @RequestBody StartPayment r) {
    return Api.ok(finance.start(Actor.current(), r.orderId()));
  }

  @GetMapping("/payments/{id}")
  public Api<Payment> payment(@PathVariable @Pattern(regexp = "[a-f0-9-]{36}") String id) {
    return Api.ok(finance.get(Actor.current(), id));
  }

  @PostMapping("/payments/{id}/simulate")
  public Api<Payment> simulate(@PathVariable @Pattern(regexp = "[a-f0-9-]{36}") String id) {
    return Api.ok(finance.simulate(Actor.current(), id));
  }

  @PostMapping("/payments/{id}/query")
  public Api<Payment> query(@PathVariable @Pattern(regexp = "[a-f0-9-]{36}") String id) {
    return Api.ok(finance.query(Actor.current(), id));
  }

  @PostMapping("/order/{id}/refunds")
  public Api<Refund> refund(@PathVariable @Positive long id, @Valid @RequestBody RefundRequest r) {
    return Api.ok(finance.request(Actor.current(), id, r.reason()));
  }

  @GetMapping("/refunds")
  public Api<PageView<RefundEntry>> refunds(
      @RequestParam(defaultValue = "seller") @Pattern(regexp = "seller|buyer|all") String scope,
      @RequestParam(required = false)
          @Pattern(regexp = "REQUESTED|APPROVED|FAILED|SUCCEEDED|REJECTED")
          String status,
      @RequestParam(required = false) @Positive Long orderId,
      @RequestParam(defaultValue = "0") @Min(0) @Max(1000000) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return Api.ok(finance.refunds(Actor.current(), scope, status, orderId, page, size));
  }

  @GetMapping("/order/{id}/refunds")
  public Api<Refund> refundForOrder(@PathVariable @Positive long id) {
    return Api.ok(finance.refundForOrder(Actor.current(), id));
  }

  @GetMapping("/refunds/{id}")
  public Api<Refund> refund(@PathVariable @Pattern(regexp = "[a-f0-9-]{36}") String id) {
    return Api.ok(finance.refund(Actor.current(), id));
  }

  @PostMapping("/refunds/{id}/{action:approve|reject|retry}")
  public Api<Refund> review(
      @PathVariable @Pattern(regexp = "[a-f0-9-]{36}") String id, @PathVariable String action) {
    return Api.ok(finance.review(Actor.current(), id, action));
  }

  @PostMapping("/order/{id}/reviews")
  public Api<Review> review(@PathVariable @Positive long id, @Valid @RequestBody ReviewRequest r) {
    return Api.ok(orders.review(Actor.current(), id, r));
  }

  @GetMapping("/item/{id}/reviews")
  public Api<PageView<Review>> reviews(
      @PathVariable @Positive long id,
      @RequestParam(defaultValue = "0") @Min(0) @Max(1000000) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return Api.ok(finance.reviews(id, page, size));
  }

  @PostMapping("/settlements")
  public Api<Settlement> settle(
      @Valid @RequestBody SettlementRequest r,
      @RequestHeader("Idempotency-Key") @Pattern(regexp = "[A-Za-z0-9_-]{1,64}") String key) {
    var a = Actor.current();
    return Api.ok(finance.settle(a, r.seller() == null ? a.id() : r.seller(), key));
  }

  @GetMapping("/settlements/{id}")
  public Api<Settlement> settlement(@PathVariable @Pattern(regexp = "[a-f0-9-]{36}") String id) {
    return Api.ok(finance.settlement(Actor.current(), id));
  }
}
