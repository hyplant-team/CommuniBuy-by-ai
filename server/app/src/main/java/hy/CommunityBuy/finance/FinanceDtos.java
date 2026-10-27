package hy.CommunityBuy.finance;

import jakarta.validation.constraints.*;
import java.util.List;

public final class FinanceDtos {
  private FinanceDtos() {}

  public record StartPayment(@NotNull @Positive Long orderId) {}

  public record Payment(
      String id,
      long orderId,
      long amount,
      String merchant,
      String channel,
      String status,
      String providerReference,
      long createTime,
      long updateTime) {}

  public record Refund(
      String id,
      long orderId,
      String paymentId,
      long amount,
      String reason,
      String status,
      int attempts,
      String providerReference,
      long createTime,
      long updateTime) {}

  public record RefundRequest(@NotBlank @Size(max = 255) String reason) {}

  public record RefundEntry(
      String id,
      long orderId,
      String buyer,
      String seller,
      long amount,
      String reason,
      String status,
      int attempts,
      long createTime,
      long updateTime) {}

  public record ReviewRequest(
      @NotNull @Positive Long itemId,
      @NotNull @Min(1) @Max(5) Integer rating,
      @NotBlank @Size(max = 1000) @Pattern(regexp = "[^<>]*") String comment) {}

  public record Review(
      long id,
      long orderId,
      long itemId,
      String user,
      int rating,
      String comment,
      long createTime) {}

  public record SettlementRequest(@Pattern(regexp = "[A-Za-z_][A-Za-z0-9_]{0,31}") String seller) {}

  public record Entry(long id, long orderId, String refundId, String kind, long amount) {}

  public record Settlement(
      String id, String seller, long netAmount, long createTime, List<Entry> entries) {}

  public record Notice(
      @NotBlank @Pattern(regexp = "[a-f0-9-]{36}") String id,
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,64}") String eventId,
      @NotNull @Min(0) Long amount,
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,64}") String merchant,
      @NotBlank @Pattern(regexp = "SUCCEEDED|FAILED") String status) {
    public String canonical() {
      return id + "|" + eventId + "|" + amount + "|" + merchant + "|" + status;
    }
  }
}
