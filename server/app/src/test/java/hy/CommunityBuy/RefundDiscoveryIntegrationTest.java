package hy.CommunityBuy;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import hy.CommunityBuy.dto.Dtos.*;
import hy.CommunityBuy.finance.FinanceService;
import hy.CommunityBuy.security.Actor;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class RefundDiscoveryIntegrationTest extends IntegrationSupport {
  @Autowired FinanceService finance;

  long paidFor(Actor customer, Actor merchant, String key) {
    var product =
        itemService.create(merchant, new NewItem("Apples", "Fresh fruit", 199, 3, 0, 0L, null));
    var purchase =
        orderService.create(customer, new NewOrder(product.id(), 1, "Private address"), key);
    orderService.action(customer, purchase.id(), "pay");
    return purchase.id();
  }

  Actor otherSeller() {
    userService.create(new CreateUser("otherSeller", "Test-password-42"));
    return new Actor("otherSeller", false);
  }

  @Test
  void sellerDiscoversBuyerRequestThroughItsOwnHttpInboxAndApprovesIt() throws Exception {
    long id = paidFor(buyer, seller, "discover");
    request("buyer", "POST", "/api/v1/order/" + id + "/refunds", Map.of("reason", "Wrong item"))
        .andExpect(status().isOk());

    // The seller gets the identifier only from its own inbox, not the buyer's response.
    var inbox =
        data(
            request("seller", "GET", "/api/v1/refunds?status=REQUESTED", null)
                .andExpect(status().isOk()));
    assertThat(inbox.path("count").asLong()).isEqualTo(1);
    var entry = inbox.path("content").get(0);
    String refundId = entry.path("id").asText();
    assertThat(entry.path("orderId").asLong()).isEqualTo(id);
    assertThat(entry.path("buyer").asText()).isEqualTo("buyer");
    assertThat(entry.path("seller").asText()).isEqualTo("seller");
    assertThat(entry.path("amount").asLong()).isEqualTo(199);
    assertThat(entry.has("address")).isFalse();
    request("seller", "GET", "/api/v1/refunds/" + refundId, null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.reason").value("Wrong item"));
    request("seller", "POST", "/api/v1/refunds/" + refundId + "/approve", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("SUCCEEDED"));
    request("seller", "POST", "/api/v1/refunds/" + refundId + "/approve", null)
        .andExpect(status().isOk());
    request("buyer", "GET", "/api/v1/order/" + id + "/refunds", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value(refundId))
        .andExpect(jsonPath("$.data.status").value("SUCCEEDED"));
    request("seller", "GET", "/api/v1/refunds?status=REQUESTED", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(0));
    request("buyer", "GET", "/api/v1/refunds?scope=buyer&status=SUCCEEDED", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.content[0].id").value(refundId));
    var purchase = orders.findById(id).orElseThrow();
    assertThat(items.findById(purchase.getItemId()).orElseThrow().getStock()).isEqualTo(3);
  }

  @Test
  void combinedFiltersAndStablePagesNeverIncludeAnotherSellersRequests() throws Exception {
    var merchant = otherSeller();
    var pending = finance.request(buyer, paidFor(buyer, seller, "pending"), "Pending");
    var rejected = finance.request(outsider, paidFor(outsider, seller, "reject"), "Rejected");
    finance.review(seller, rejected.id(), "reject");
    var foreign = finance.request(buyer, paidFor(buyer, merchant, "foreign"), "Other seller");

    var first = data(request("seller", "GET", "/api/v1/refunds?page=0&size=1", null));
    var second = data(request("seller", "GET", "/api/v1/refunds?page=1&size=1", null));
    assertThat(first.path("count").asLong()).isEqualTo(2);
    assertThat(second.path("count").asLong()).isEqualTo(2);
    var actual =
        List.of(
            first.path("content").get(0).path("id").asText(),
            second.path("content").get(0).path("id").asText());
    var expected = new ArrayList<>(List.of(pending.id(), rejected.id()));
    expected.sort(Comparator.reverseOrder());
    assertThat(actual).containsExactlyElementsOf(expected);
    var repeated = data(request("seller", "GET", "/api/v1/refunds?page=0&size=1", null));
    assertThat(repeated.path("content")).isEqualTo(first.path("content"));
    request("seller", "GET", "/api/v1/refunds?status=REJECTED&orderId=" + rejected.orderId(), null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(1))
        .andExpect(jsonPath("$.data.content[0].id").value(rejected.id()));
    request("seller", "GET", "/api/v1/refunds?status=REQUESTED&orderId=" + rejected.orderId(), null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(0));
    request("seller", "GET", "/api/v1/refunds?orderId=" + foreign.orderId(), null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(0));
    request("seller", "GET", "/api/v1/refunds?owner=otherSeller&user=buyer", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(2));
    request("otherSeller", "GET", "/api/v1/refunds", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.content[0].id").value(foreign.id()))
        .andExpect(jsonPath("$.data.count").value(1));
    request("buyer", "GET", "/api/v1/refunds?scope=buyer", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(2));
    request("seller", "GET", "/api/v1/refunds?page=2&size=1", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.content").isEmpty())
        .andExpect(jsonPath("$.data.count").value(2));
  }

  @Test
  void globalScopeRequiresAdminAndDetailAndActionsRemainPrivate() throws Exception {
    var r = finance.request(buyer, paidFor(buyer, seller, "private"), "Private reason");
    request(null, "GET", "/api/v1/refunds", null).andExpect(status().isUnauthorized());
    for (String user : List.of("buyer", "seller", "outsider"))
      request(user, "GET", "/api/v1/refunds?scope=all", null).andExpect(status().isForbidden());
    request("outsider", "GET", "/api/v1/refunds", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(0));
    request("outsider", "GET", "/api/v1/order/" + r.orderId() + "/refunds", null)
        .andExpect(status().isForbidden());
    request("outsider", "GET", "/api/v1/refunds/" + r.id(), null).andExpect(status().isForbidden());
    request("outsider", "POST", "/api/v1/refunds/" + r.id() + "/approve", null)
        .andExpect(status().isForbidden());
    request("buyer", "POST", "/api/v1/refunds/" + r.id() + "/approve", null)
        .andExpect(status().isForbidden());
    request("admin", "GET", "/api/v1/refunds?scope=all", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.count").value(1));
    request("admin", "GET", "/api/v1/order/" + r.orderId() + "/refunds", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value(r.id()));
    request("admin", "POST", "/api/v1/refunds/" + r.id() + "/reject", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("REJECTED"));
  }

  @Test
  void absentApplicationIsNullButOrderPermissionsAndExistenceAreStillChecked() throws Exception {
    long id = paidFor(buyer, seller, "no-refund");
    for (String user : List.of("buyer", "seller", "admin")) {
      var response =
          data(
              request(user, "GET", "/api/v1/order/" + id + "/refunds", null)
                  .andExpect(status().isOk()));
      assertThat(response.isNull()).isTrue();
    }
    request("outsider", "GET", "/api/v1/order/" + id + "/refunds", null)
        .andExpect(status().isForbidden());
    request("buyer", "GET", "/api/v1/order/9223372036854775807/refunds", null)
        .andExpect(status().isNotFound());
    request("buyer", "GET", "/api/v1/order/0/refunds", null).andExpect(status().isBadRequest());
  }

  @Test
  void invalidScopeStatusOrderAndPaginationAreRejected() throws Exception {
    for (String query :
        List.of(
            "scope=outsider",
            "status=UNKNOWN",
            "orderId=0",
            "orderId=-1",
            "orderId=abc",
            "page=-1",
            "page=1000001",
            "size=0",
            "size=101"))
      request("seller", "GET", "/api/v1/refunds?" + query, null).andExpect(status().isBadRequest());
  }
}
