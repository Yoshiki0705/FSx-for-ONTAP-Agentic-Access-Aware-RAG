"use strict";
/*
 *  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *  Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const constructs_1 = require("constructs");
const config_1 = require("../../config");
const aws_cdk_lib_1 = require("aws-cdk-lib");
class Database extends constructs_1.Construct {
    dynamo;
    constructor(scope, id, props) {
        super(scope, id);
        this.dynamo = new aws_dynamodb_1.TableV2(this, "SessionTable", {
            ...props,
            tableName: `${config_1.devConfig.userName}-SessionTable`,
            deletionProtection: false,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
    }
}
exports.Database = Database;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7O0FBRUgsMkRBQW1EO0FBQ25ELDJDQUF1QztBQUN2Qyx5Q0FBeUM7QUFDekMsNkNBQTRDO0FBRzVDLE1BQWEsUUFBUyxTQUFRLHNCQUFTO0lBQ3JCLE1BQU0sQ0FBVTtJQUNoQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXFCO1FBQzdELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLHNCQUFPLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUM5QyxHQUFHLEtBQUs7WUFDUixTQUFTLEVBQUUsR0FBRyxrQkFBUyxDQUFDLFFBQVEsZUFBZTtZQUMvQyxrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLGFBQWEsRUFBRSwyQkFBYSxDQUFDLE9BQU87U0FDckMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBWkQsNEJBWUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogIENvcHlyaWdodCAyMDI1IEFtYXpvbi5jb20sIEluYy4gb3IgaXRzIGFmZmlsaWF0ZXMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiAgU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IExpY2Vuc2VSZWYtLmFtYXpvbi5jb20uLUFtem5TTC0xLjBcbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQW1hem9uIFNvZnR3YXJlIExpY2Vuc2UgIGh0dHA6Ly9hd3MuYW1hem9uLmNvbS9hc2wvXG4gKi9cblxuaW1wb3J0IHsgVGFibGVWMiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGJcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgeyBkZXZDb25maWcgfSBmcm9tIFwiLi4vLi4vY29uZmlnXCI7XG5pbXBvcnQgeyBSZW1vdmFsUG9saWN5IH0gZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBEYXRhYmFzZUNvbmZpZyB9IGZyb20gXCIuLi8uLi90eXBlcy90eXBlXCI7XG5cbmV4cG9ydCBjbGFzcyBEYXRhYmFzZSBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBkeW5hbW86IFRhYmxlVjI7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBEYXRhYmFzZUNvbmZpZykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLmR5bmFtbyA9IG5ldyBUYWJsZVYyKHRoaXMsIFwiU2Vzc2lvblRhYmxlXCIsIHtcbiAgICAgIC4uLnByb3BzLFxuICAgICAgdGFibGVOYW1lOiBgJHtkZXZDb25maWcudXNlck5hbWV9LVNlc3Npb25UYWJsZWAsXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuICB9XG59XG4iXX0=