import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnGatewayRoute } from './appmesh.generated';
import { GatewayRouteSpec } from './gateway-route-spec';
import { IVirtualGateway, VirtualGateway } from './virtual-gateway';

/**
 * Interface for which all GatewayRoute based classes MUST implement
 */
export interface IGatewayRoute extends cdk.IResource {
  /**
   * The name of the GatewayRoute
   *
   * @attribute
   */
  readonly gatewayRouteName: string,

  /**
   * The Amazon Resource Name (ARN) for the GatewayRoute
   *
   * @attribute
   */
  readonly gatewayRouteArn: string;

  /**
   * The VirtualGateway the GatewayRoute belongs to
   */
  readonly virtualGateway: IVirtualGateway;

  /**
   * Grants the given entity all read permissions for this GatewayRoute.
   */
  grantRead(identity: iam.IGrantable): iam.Grant;

  /**
   * Grants the given entity all write permissions for this GatewayRoute.
   */
  grantWrite(identity: iam.IGrantable): iam.Grant;

}

abstract class GatewayRouteBase extends cdk.Resource implements IGatewayRoute {
  /**
   * The name of the GatewayRoute
   *
   * @attribute
   */
  public abstract readonly gatewayRouteName: string;

  /**
   * The Amazon Resource Name (ARN) for the GatewayRoute
   *
   * @attribute
   */
  public abstract readonly gatewayRouteArn: string;

  /**
   * The VirtualGateway the GatewayRoute belongs to
   */
  public abstract readonly virtualGateway: IVirtualGateway;

  /**
   * Grants the given entity all read permissions for this VirtualGateway.
   */
  public grantRead(identity: iam.IGrantable): iam.Grant {
    return this.grant(identity,
      'appmesh:DescribeGatewayRoute',
      'appmesh:ListGatewayRoute',
    );
  }

  /**
   * Grants the given entity all write permissions for this VirtualGateway.
   */
  public grantWrite(identity: iam.IGrantable): iam.Grant {
    return this.grant(identity,
      'appmesh:CreateGatewayRoute',
      'appmesh:UpdateGatewayRoute',
      'appmesh:DeleteGatewayRoute',
      'appmesh:TagResource',
      'appmesh:UntagResource',
    );
  }

  /**
   * Grant the specified actions for this GatewayRoute.
   */
  private grant(grantee: iam.IGrantable, ...actions: string[]) {
    return iam.Grant.addToPrincipal({
      grantee,
      actions,
      resourceArns: [this.gatewayRouteArn],
    });
  }
}

/**
 * Basic configuration properties for a GatewayRoute
 */
export interface GatewayRouteBaseProps {
  /**
   * The name of the GatewayRoute
   *
   * @default - an automatically generated name
   */
  readonly gatewayRouteName?: string;

  /**
   * What protocol the route uses
   */
  readonly routeSpec: GatewayRouteSpec;
}

/**
 * Properties to define a new GatewayRoute
 */
export interface GatewayRouteProps extends GatewayRouteBaseProps {
  /**
   * The VirtualGateway this GatewayRoute is associated with
   */
  readonly virtualGateway: IVirtualGateway;
}

/**
 * GatewayRoute represents a new or existing gateway route attached to a VirtualGateway and Mesh
 *
 * @see https://docs.aws.amazon.com/app-mesh/latest/userguide/gateway-routes.html
 */
export class GatewayRoute extends GatewayRouteBase {
  /**
   * Import an existing GatewayRoute given an ARN
   */
  public static fromGatewayRouteArn(scope: Construct, id: string, gatewayRouteArn: string): IGatewayRoute {
    return new class extends GatewayRouteBase {
      readonly gatewayRouteArn = gatewayRouteArn;
      readonly gatewayRouteName = cdk.Fn.select(4, cdk.Fn.split('/', cdk.Stack.of(scope).parseArn(gatewayRouteArn).resourceName!));
      readonly virtualGateway = VirtualGateway.fromVirtualGatewayArn(this, 'virtualGateway', gatewayRouteArn);
    }(scope, id);
  }

  /**
   * Import an existing GatewayRoute given attributes
   */
  public static fromGatewayRouteAttributes(scope: Construct, id: string, attrs: GatewayRouteAttributes): IGatewayRoute {
    return new class extends GatewayRouteBase {
      readonly gatewayRouteName = attrs.gatewayRouteName;
      readonly gatewayRouteArn = cdk.Stack.of(scope).formatArn({
        service: 'appmesh',
        resource: `mesh/${attrs.virtualGateway.mesh.meshName}/virtualGateway/${attrs.virtualGateway.virtualGatewayName}/gatewayRoute`,
        resourceName: this.gatewayRouteName,
      });
      readonly virtualGateway = attrs.virtualGateway;
    }(scope, id);
  }

  /**
   * The name of the GatewayRoute
   */
  public readonly gatewayRouteName: string;

  /**
   * The Amazon Resource Name (ARN) for the GatewayRoute
   */
  public readonly gatewayRouteArn: string;

  /**
   * The VirtualGateway this GatewayRoute is a part of
   */
  public readonly virtualGateway: IVirtualGateway;

  constructor(scope: Construct, id: string, props: GatewayRouteProps) {
    super(scope, id, {
      physicalName: props.gatewayRouteName || cdk.Lazy.stringValue({ produce: () => this.node.uniqueId }),
    });

    this.virtualGateway = props.virtualGateway;
    const routeSpecConfig = props.routeSpec.bind(this);

    const gatewayRoute = new CfnGatewayRoute(this, 'Resource', {
      gatewayRouteName: this.physicalName,
      meshName: props.virtualGateway.mesh.meshName,
      spec: {
        httpRoute: routeSpecConfig.httpSpecConfig,
        http2Route: routeSpecConfig.http2SpecConfig,
        grpcRoute: routeSpecConfig.grpcSpecConfig,
      },
      virtualGatewayName: this.virtualGateway.virtualGatewayName,
    });

    this.gatewayRouteName = this.getResourceNameAttribute(gatewayRoute.attrGatewayRouteName);
    this.gatewayRouteArn = this.getResourceArnAttribute(gatewayRoute.ref, {
      service: 'appmesh',
      resource: `mesh/${props.virtualGateway.mesh.meshName}/virtualRouter/${this.virtualGateway.virtualGatewayName}/gatewayRoute`,
      resourceName: this.physicalName,
    });
  }
}

/**
 * Interface with properties necessary to import a reusable GatewayRoute
 */
export interface GatewayRouteAttributes {
  /**
   * The name of the GatewayRoute
   */
  readonly gatewayRouteName: string;

  /**
   * The VirtualGateway this GatewayRoute is associated with.
   */
  readonly virtualGateway: IVirtualGateway;
}
