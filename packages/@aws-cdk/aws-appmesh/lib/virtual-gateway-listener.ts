import { CfnCertificate } from '@aws-cdk/aws-acmpca';
import * as cdk from '@aws-cdk/core';
import { CfnVirtualGateway } from './appmesh.generated';
import { validateHealthChecks } from './private/utils';
import { HealthCheck, Protocol } from './shared-interfaces';
import { AcmTlsCertificate, TlsCertificate } from './tls-certificate';
import { IListenerTlsConfig } from './virtual-node-listener';

/**
 * Represents the properties needed to define HTTP Listeners for a VirtualGateway
 */
export interface HttpGatewayListenerProps {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port?: number

  /**
   * The health check information for the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;

  /**
   * The TLS configuration for the listener
   *
   * @default - none
   */
  readonly tls?: IListenerTlsConfig;
}

/**
 * Represents the properties needed to define GRPC Listeners for a VirtualGateway
 */
export interface GrpcGatewayListenerProps {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port?: number

  /**
   * The health check information for the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;

  /**
   * The TLS configuration for the listener
   *
   * @default - none
   */
  readonly tls?: IListenerTlsConfig;
}

/**
 * Properties for a VirtualGateway listener
 */
export interface VirtualGatewayListenerConfig {
  /**
   * Single listener config for a VirtualGateway
   */
  readonly listener: CfnVirtualGateway.VirtualGatewayListenerProperty,
}

/**
 * Represents the properties needed to define listeners for a VirtualGateway
 */
export abstract class VirtualGatewayListener {
  /**
   * Returns an HTTP Listener for a VirtualGateway
   */
  public static httpGatewayListener(props: HttpGatewayListenerProps = {}): VirtualGatewayListener {
    return new HttpGatewayListener(props);
  }

  /**
   * Returns an HTTP2 Listener for a VirtualGateway
   */
  public static http2GatewayListener(props: HttpGatewayListenerProps = {}): VirtualGatewayListener {
    return new Http2GatewayListener(props);
  }

  /**
   * Returns a GRPC Listener for a VirtualGateway
   */
  public static grpcGatewayListener(props: GrpcGatewayListenerProps = {}): VirtualGatewayListener {
    return new GrpcGatewayListener(props);
  }

  /**
   * Protocol the listener implements
   */
  protected abstract protocol: Protocol;

  /**
   * Port to listen for connections on
   */
  protected abstract port: number;

  /**
   * Health checking strategy upstream nodes should use when communicating with the listener
   */
  protected abstract healthCheck?: HealthCheck;

  /**
   * Configuration of TLS for the listener.
   */
  protected abstract tls?: IListenerTlsConfig;

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public abstract bind(scope: cdk.Construct): VirtualGatewayListenerConfig;

  protected renderHealthCheck(hc: HealthCheck): CfnVirtualGateway.VirtualGatewayHealthCheckPolicyProperty | undefined {
    if (hc.protocol === Protocol.TCP) {
      throw new Error('TCP health checks are not permitted for gateway listeners');
    }

    if (hc.protocol === Protocol.GRPC && hc.path) {
      throw new Error('The path property cannot be set with Protocol.GRPC');
    }

    const protocol = hc.protocol? hc.protocol : this.protocol;

    const healthCheck: CfnVirtualGateway.VirtualGatewayHealthCheckPolicyProperty = {
      healthyThreshold: hc.healthyThreshold || 2,
      intervalMillis: (hc.interval || cdk.Duration.seconds(5)).toMilliseconds(), // min
      path: hc.path || ((protocol === Protocol.HTTP || protocol === Protocol.HTTP2) ? '/' : undefined),
      port: hc.port || this.port,
      protocol: hc.protocol || this.protocol,
      timeoutMillis: (hc.timeout || cdk.Duration.seconds(2)).toMilliseconds(),
      unhealthyThreshold: hc.unhealthyThreshold || 2,
    };

    validateHealthChecks(healthCheck);

    return healthCheck;
  }

  protected renderTls(tls: IListenerTlsConfig): CfnVirtualGateway.VirtualGatewayListenerTlsProperty {

    if (this.isAcmCertificate(tls.certificate)) {
      tls.certificate = new AcmTlsCertificate({
        acmCertificate: tls.certificate.attrArn,
      });
    }

    return {
      certificate: tls.certificate.bind(),
      mode: tls.mode,
    };
  }

  private isAcmCertificate(cert: TlsCertificate | CfnCertificate): cert is CfnCertificate {
    return (cert as CfnCertificate).attrArn !== undefined;
  }
}

/**
 * Represents the properties needed to define an HTTP Listener for a VirtualGateway
 */
class HttpGatewayListener extends VirtualGatewayListener {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port: number;

  /**
   * Health checking strategy upstream nodes should use when communicating with the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;

  /**
   * Protocol the listener implements
   */
  protected protocol: Protocol = Protocol.HTTP;

  /**
   * Configuration of TLS for the listener.
   */
  readonly tls?: IListenerTlsConfig;

  constructor(props: HttpGatewayListenerProps = {}) {
    super();
    this.port = props.port ? props.port : 8080;
    this.healthCheck = props.healthCheck;
    this.tls = props.tls;
  }

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public bind(_scope: cdk.Construct): VirtualGatewayListenerConfig {
    return {
      listener: {
        portMapping: {
          port: this.port,
          protocol: this.protocol,
        },
        healthCheck: this.healthCheck ? this.renderHealthCheck(this.healthCheck): undefined,
        tls: this.tls ? this.renderTls(this.tls): undefined,
      },
    };
  }
}

/**
* Represents the properties needed to define an HTTP2 Listener for a VirtualGateway
*/
class Http2GatewayListener extends HttpGatewayListener {
  constructor(props: HttpGatewayListenerProps = {}) {
    super(props);
    this.protocol = Protocol.HTTP2;
  }
}

/**
 * Represents the properties needed to define a GRPC Listener for Virtual Gateway
 */
class GrpcGatewayListener extends VirtualGatewayListener {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port: number;

  /**
   * Health checking strategy upstream nodes should use when communicating with the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;

  /**
   * Protocol the listener implements
   */
  protected protocol: Protocol = Protocol.GRPC;

  /**
   * Configuration of TLS for the listener.
   */
  readonly tls?: IListenerTlsConfig;

  constructor(props: HttpGatewayListenerProps = {}) {
    super();
    this.port = props.port ? props.port : 8080;
    this.healthCheck = props.healthCheck;
    this.tls = props.tls;
  }

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public bind(_scope: cdk.Construct): VirtualGatewayListenerConfig {
    return {
      listener: {
        portMapping: {
          port: this.port,
          protocol: Protocol.GRPC,
        },
        healthCheck: this.healthCheck? this.renderHealthCheck(this.healthCheck): undefined,
        tls: this.tls ? this.renderTls(this.tls): undefined,
      },
    };
  }
}