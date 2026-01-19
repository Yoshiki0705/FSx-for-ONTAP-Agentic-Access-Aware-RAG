"use strict";
/**
 * 本番環境リソースID管理
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionResourceIds = void 0;
exports.ProductionResourceIds = {
    // VPC設定
    vpc: {
        id: 'vpc-0a1b2c3d4e5f6g7h8',
        cidr: '10.0.0.0/16'
    },
    // サブネット設定
    subnets: {
        public: ['subnet-pub1', 'subnet-pub2'],
        private: ['subnet-priv1', 'subnet-priv2']
    },
    // セキュリティグループ
    securityGroups: {
        lambda: 'sg-lambda-001',
        fsx: 'sg-fsx-001',
        opensearch: 'sg-opensearch-001'
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdGlvbi1yZXNvdXJjZS1pZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwcm9kdWN0aW9uLXJlc291cmNlLWlkcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQUVVLFFBQUEscUJBQXFCLEdBQUc7SUFDbkMsUUFBUTtJQUNSLEdBQUcsRUFBRTtRQUNILEVBQUUsRUFBRSx1QkFBdUI7UUFDM0IsSUFBSSxFQUFFLGFBQWE7S0FDcEI7SUFFRCxVQUFVO0lBQ1YsT0FBTyxFQUFFO1FBQ1AsTUFBTSxFQUFFLENBQUMsYUFBYSxFQUFFLGFBQWEsQ0FBQztRQUN0QyxPQUFPLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDO0tBQzFDO0lBRUQsYUFBYTtJQUNiLGNBQWMsRUFBRTtRQUNkLE1BQU0sRUFBRSxlQUFlO1FBQ3ZCLEdBQUcsRUFBRSxZQUFZO1FBQ2pCLFVBQVUsRUFBRSxtQkFBbUI7S0FDaEM7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDmnKznlarnkrDlooPjg6rjgr3jg7zjgrlJROeuoeeQhlxuICovXG5cbmV4cG9ydCBjb25zdCBQcm9kdWN0aW9uUmVzb3VyY2VJZHMgPSB7XG4gIC8vIFZQQ+ioreWumlxuICB2cGM6IHtcbiAgICBpZDogJ3ZwYy0wYTFiMmMzZDRlNWY2ZzdoOCcsXG4gICAgY2lkcjogJzEwLjAuMC4wLzE2J1xuICB9LFxuICBcbiAgLy8g44K144OW44ON44OD44OI6Kit5a6aXG4gIHN1Ym5ldHM6IHtcbiAgICBwdWJsaWM6IFsnc3VibmV0LXB1YjEnLCAnc3VibmV0LXB1YjInXSxcbiAgICBwcml2YXRlOiBbJ3N1Ym5ldC1wcml2MScsICdzdWJuZXQtcHJpdjInXVxuICB9LFxuICBcbiAgLy8g44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXXG4gIHNlY3VyaXR5R3JvdXBzOiB7XG4gICAgbGFtYmRhOiAnc2ctbGFtYmRhLTAwMScsXG4gICAgZnN4OiAnc2ctZnN4LTAwMScsXG4gICAgb3BlbnNlYXJjaDogJ3NnLW9wZW5zZWFyY2gtMDAxJ1xuICB9XG59O1xuXG5leHBvcnQgdHlwZSBQcm9kdWN0aW9uUmVzb3VyY2VJZHNUeXBlID0gdHlwZW9mIFByb2R1Y3Rpb25SZXNvdXJjZUlkcztcbiJdfQ==