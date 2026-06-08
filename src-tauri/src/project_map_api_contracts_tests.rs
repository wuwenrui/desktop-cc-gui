use super::{build_api_contract_artifact, stable_hash};
use crate::project_map_relations::ScannedFile;
use serde_json::Value;

fn scanned_file(path: &str, extension: &str, language: &str, content: &str) -> ScannedFile {
    ScannedFile {
        id: format!("file-{}", stable_hash(path)),
        path: path.to_string(),
        basename: path.rsplit('/').next().unwrap_or(path).to_string(),
        extension: extension.to_string(),
        language: language.to_string(),
        layer: "api".to_string(),
        role: "route".to_string(),
        size_bytes: content.len() as u64,
        line_count: content.lines().count(),
        content_hash: stable_hash(content),
        parse_status: "parsed".to_string(),
    }
}

#[test]
fn strong_contract_adapters_emit_schema_backed_endpoints() {
    let openapi = r#"
openapi: 3.0.0
info:
  title: Fleet API
paths:
  /vehicles/{id}:
    get:
      operationId: getVehicle
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Vehicle'
"#;
    let proto = r#"
syntax = "proto3";
package fleet.v1;
service VehicleService {
  rpc GetVehicle (GetVehicleRequest) returns (VehicleReply);
}
"#;
    let graphql = r#"
type Query {
  vehicle(id: ID!): Vehicle
}
"#;
    let artifact = build_api_contract_artifact(
        &[
            (
                scanned_file("openapi.yaml", "yaml", "yaml", openapi),
                openapi.to_string(),
            ),
            (
                scanned_file("fleet.proto", "proto", "proto", proto),
                proto.to_string(),
            ),
            (
                scanned_file("schema.graphql", "graphql", "graphql", graphql),
                graphql.to_string(),
            ),
        ],
        "mossx-test",
        "scan-test",
        "2026-06-07T00:00:00Z",
        &[],
    );
    let endpoints = artifact.get("endpoints").and_then(Value::as_array).unwrap();
    assert!(endpoints.iter().any(|endpoint| {
        endpoint.get("protocol").and_then(Value::as_str) == Some("http")
            && endpoint.get("confidence").and_then(Value::as_str) == Some("spec")
    }));
    assert!(endpoints.iter().any(|endpoint| {
        endpoint.get("protocol").and_then(Value::as_str) == Some("grpc")
            && endpoint.get("confidence").and_then(Value::as_str) == Some("spec")
    }));
    assert!(endpoints.iter().any(|endpoint| {
        endpoint.get("protocol").and_then(Value::as_str) == Some("graphql")
            && endpoint.get("confidence").and_then(Value::as_str) == Some("spec")
    }));
    assert!(
        artifact
            .get("schemas")
            .and_then(Value::as_array)
            .unwrap()
            .len()
            >= 3
    );
    let adapters = artifact.get("adapters").and_then(Value::as_array).unwrap();
    assert!(adapters.iter().any(|adapter| {
        adapter.get("language").and_then(Value::as_str) == Some("openapi")
            && adapter.get("status").and_then(Value::as_str) == Some("active")
    }));
    assert!(adapters.iter().any(|adapter| {
        adapter.get("language").and_then(Value::as_str) == Some("protobuf")
            && adapter.get("status").and_then(Value::as_str) == Some("active")
    }));
    assert!(adapters.iter().any(|adapter| {
        adapter.get("language").and_then(Value::as_str) == Some("graphql")
            && adapter.get("status").and_then(Value::as_str) == Some("active")
    }));
}

#[test]
fn duplicate_http_contract_and_source_candidates_merge_evidence() {
    let openapi = r#"
openapi: 3.0.0
info:
  title: Users API
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        '200':
          description: ok
"#;
    let source = r#"
import express from "express";
const app = express();
app.get("/users", listUsers);
function listUsers(req, res) {
  return userService.listUsers();
}
"#;
    let artifact = build_api_contract_artifact(
        &[
            (
                scanned_file("openapi.yaml", "yaml", "yaml", openapi),
                openapi.to_string(),
            ),
            (
                scanned_file("src/routes/users.ts", "ts", "typescript", source),
                source.to_string(),
            ),
        ],
        "mossx-test",
        "scan-test",
        "2026-06-07T00:00:00Z",
        &[],
    );
    let endpoints = artifact.get("endpoints").and_then(Value::as_array).unwrap();
    let users = endpoints
        .iter()
        .filter(|endpoint| {
            endpoint.get("protocol").and_then(Value::as_str) == Some("http")
                && endpoint.get("method").and_then(Value::as_str) == Some("GET")
                && endpoint.get("path").and_then(Value::as_str) == Some("/users")
        })
        .collect::<Vec<_>>();
    assert_eq!(users.len(), 1);
    assert!(
        users[0]
            .get("evidence")
            .and_then(Value::as_array)
            .unwrap()
            .len()
            >= 2
    );
    assert!(
        users[0]
            .get("callChainIds")
            .and_then(Value::as_array)
            .unwrap()
            .len()
            <= 1
    );
}

#[test]
fn java_spring_swagger_annotations_emit_detail_contract() {
    let source = r#"
package com.ftrd.odp.controller;

@RestController
@RequestMapping("/api/device-vehicle/od-pay/v1/fcs-order")
public class VehicleFcsOrderController {
    @Operation(summary = "取消订单")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "成功"),
        @ApiResponse(responseCode = "500", description = "该订单已取消，不可再次操作")
    })
    @PostMapping("/cancel")
    public R cancel(@Parameter(description = "订单号") @RequestBody FcsOrderCancelParam orderCancelParam) {
        return R.ok();
    }
}

public class FcsOrderCancelParam {
    /** 订单号 */
    @Schema(description = "订单号", example = "OD123")
    @NotBlank
    private String orderNo;
}
"#;
    let artifact = build_api_contract_artifact(
        &[(
            scanned_file(
                "src/main/java/com/ftrd/odp/controller/VehicleFcsOrderController.java",
                "java",
                "java",
                source,
            ),
            source.to_string(),
        )],
        "mossx-java",
        "scan-java",
        "2026-06-07T00:00:00Z",
        &[],
    );
    let endpoints = artifact.get("endpoints").and_then(Value::as_array).unwrap();
    let endpoint = endpoints
        .iter()
        .find(|endpoint| endpoint.get("path").and_then(Value::as_str) == Some("/api/device-vehicle/od-pay/v1/fcs-order/cancel"))
        .expect("expected cancel endpoint");
    assert_eq!(endpoint.get("method").and_then(Value::as_str), Some("POST"));
    assert_eq!(endpoint.get("description").and_then(Value::as_str), Some("取消订单"));
    assert_eq!(
        endpoint
            .get("requestBody")
            .and_then(|body| body.get("schema"))
            .and_then(|schema| schema.get("name"))
            .and_then(Value::as_str),
        Some("FcsOrderCancelParam"),
    );
    assert!(
        endpoint
            .get("parameters")
            .and_then(Value::as_array)
            .map(|parameters| parameters.iter().any(|parameter| {
                parameter.get("location").and_then(Value::as_str) == Some("body")
                    && parameter.get("name").and_then(Value::as_str) == Some("orderCancelParam")
                    && parameter
                        .get("structuredFields")
                        .and_then(Value::as_array)
                        .map(|fields| fields.iter().any(|field| {
                            field.get("name").and_then(Value::as_str) == Some("orderNo")
                                && field.get("description").and_then(Value::as_str) == Some("订单号")
                                && field.get("required").and_then(Value::as_bool) == Some(true)
                        }))
                        .unwrap_or(false)
            }))
            .unwrap_or(false)
    );
    assert!(
        endpoint
            .get("descriptionSources")
            .and_then(Value::as_array)
            .map(|sources| sources.iter().any(|source| {
                source.get("text").and_then(Value::as_str) == Some("取消订单")
            }))
            .unwrap_or(false)
    );
    assert!(
        endpoint
            .get("responses")
            .and_then(Value::as_array)
            .map(|responses| responses.iter().any(|response| {
                response.get("statusCode").and_then(Value::as_str) == Some("500")
                    && response
                        .get("structuredFields")
                        .and_then(Value::as_array)
                        .map(|fields| fields.iter().any(|field| {
                            field
                                .get("description")
                                .and_then(Value::as_str)
                                == Some("该订单已取消，不可再次操作")
                        }))
                        .unwrap_or(false)
            }))
            .unwrap_or(false)
    );
}

#[test]
fn java_request_body_parameter_expands_dto_fields() {
    let source = r#"
package com.ftrd.odp.controller;

@RestController
@RequestMapping("/api/device-vehicle/od-pay/v1/fcs-order")
public class VehicleFcsOrderController {
    /**
     * 校验用户是否实名认证
     *
     * @param realNameCheckParam 实名认证参数
     * @return 结果
     */
    @Operation(summary = "校验用户是否实名认证(23mm)")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "成功"),
        @ApiResponse(responseCode = "500", description = "系统内部错误")
    })
    @PostMapping("/mm/check-real")
    public R<Boolean> checkRealNameFor23MM(@RequestBody RealNameCheckParam realNameCheckParam) {
        return R.ok(Boolean.TRUE);
    }
}

public class RealNameCheckParam {
    /** 车辆 VIN */
    @Schema(description = "车辆 VIN", example = "L123456789")
    @NotBlank
    private String vin;
}
"#;
    let artifact = build_api_contract_artifact(
        &[(
            scanned_file(
                "src/main/java/com/ftrd/odp/controller/VehicleFcsOrderController.java",
                "java",
                "java",
                source,
            ),
            source.to_string(),
        )],
        "mossx-java",
        "scan-java",
        "2026-06-07T00:00:00Z",
        &[],
    );
    let endpoint = artifact
        .get("endpoints")
        .and_then(Value::as_array)
        .unwrap()
        .iter()
        .find(|endpoint| endpoint.get("path").and_then(Value::as_str) == Some("/api/device-vehicle/od-pay/v1/fcs-order/mm/check-real"))
        .expect("expected check-real endpoint");
    assert_eq!(
        endpoint.get("description").and_then(Value::as_str),
        Some("校验用户是否实名认证(23mm)")
    );
    assert!(
        endpoint
            .get("parameters")
            .and_then(Value::as_array)
            .map(|parameters| parameters.iter().any(|parameter| {
                parameter.get("location").and_then(Value::as_str) == Some("body")
                    && parameter.get("schema").and_then(|schema| schema.get("name")).and_then(Value::as_str) == Some("RealNameCheckParam")
                    && parameter
                        .get("structuredFields")
                        .and_then(Value::as_array)
                        .map(|fields| fields.iter().any(|field| {
                            field.get("name").and_then(Value::as_str) == Some("vin")
                                && field.get("description").and_then(Value::as_str) == Some("车辆 VIN")
                                && field.get("example").and_then(Value::as_str) == Some("L123456789")
                        }))
                        .unwrap_or(false)
            }))
            .unwrap_or(false)
    );
    assert!(
        endpoint
            .get("responses")
            .and_then(Value::as_array)
            .map(|responses| responses.iter().any(|response| {
                response.get("statusCode").and_then(Value::as_str) == Some("200")
                    && response.get("schema").and_then(|schema| schema.get("name")).and_then(Value::as_str) == Some("R<Boolean>")
            }))
            .unwrap_or(false)
    );
}

#[test]
fn large_endpoint_fixture_preserves_group_first_artifact_shape() {
    let routes = (0..64)
        .map(|index| {
            format!(
                "app.post(\"/orders/{index}\", orderController{index});\nfunction orderController{index}(req, res) {{\n  return orderService.createOrder{index}(req.body);\n}}\n"
            )
        })
        .collect::<String>();
    let artifact = build_api_contract_artifact(
        &[(
            scanned_file("src/routes/orders.ts", "ts", "typescript", &routes),
            routes,
        )],
        "mossx-large",
        "scan-large",
        "2026-06-07T00:00:00Z",
        &[serde_json::json!({
            "path": "node_modules/express/index.js",
            "reason": "ignored by dependency directory"
        })],
    );
    let endpoints = artifact.get("endpoints").and_then(Value::as_array).unwrap();
    let groups = artifact.get("groups").and_then(Value::as_array).unwrap();
    let call_chains = artifact
        .get("callChains")
        .and_then(Value::as_array)
        .unwrap();
    assert!(endpoints.len() > 50);
    assert!(groups.iter().any(|group| {
        group.get("level").and_then(Value::as_str) == Some("protocol")
            && group
                .get("endpointIds")
                .and_then(Value::as_array)
                .map(|ids| ids.len() > 50)
                .unwrap_or(false)
    }));
    assert!(endpoints.iter().all(|endpoint| {
        endpoint
            .get("groupIds")
            .and_then(Value::as_array)
            .map(|ids| ids.len() >= 3)
            .unwrap_or(false)
    }));
    assert!(!call_chains.is_empty());
    assert!(artifact
        .get("skipped")
        .and_then(Value::as_array)
        .unwrap()
        .iter()
        .any(|item| item.get("reason").and_then(Value::as_str) == Some("dependency-directory")));
}
