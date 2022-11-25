import React from "react";
import './TwoLines.scss';
import cn from 'classnames';
// import SVGIcon from "./components/SVGIcon";
import * as echarts from 'echarts';
import {DatePickerService} from "../services/ds/DatePickerService";
import formatNumberWithString from "format-number-with-string";

export default class TwoLines extends React.Component<any> {
  private _datePickerService: DatePickerService;
  public _chart: any = null;
      public state: {
        data: any;
        periodStart: number;
        periodStartName: string;
        periodFinish: number;
        periodFinishName: string;
      };

      public constructor(props) {
        super(props);
        this.state = {
          data: [],
          periodStart: 0,
          periodFinish: 0,
          periodStartName: '',
          periodFinishName: ''
        };
      }

      public componentDidMount(): void {
        const {cfg} = this.props;
        const koob = cfg.getRaw().koob;
        this._datePickerService = DatePickerService.createInstance(koob);
        this._datePickerService.subscribeUpdatesAndNotify(this._onSvcUpdated);
      }
      private _onSvcUpdated = (model) => {
        const {cfg} = this.props;
        const filters = cfg.getRaw().dataSource?.filters || {};
        if (model.loading || model.error) return;
        let period_names = [];
        let periods = [];
        let scenarios = [];
        if (model.currentPeriodTypeFrom == 1) {
          if (!scenarios.includes(model.currentScenarioFrom)) {
            scenarios.push(model.currentScenarioFrom);
          }
        } else {
          model.currentPeriodFrom.map(id => {
            if (!periods.includes(id)) {
              periods.push(id);
            }
          });
        }
        if (model.currentPeriodTypeTo == 1) {
          if (!scenarios.includes(model.currentScenarioTo)) {
            scenarios.push(model.currentScenarioTo);
          }
        } else {
          model.currentPeriodTo.map(id => {
            if (!periods.includes(id)) {
              periods.push(id);
            }
          })
        }
        if (!period_names.includes(model.currentPeriodTypeFrom)) {
          period_names.push(model.currentPeriodTypeFrom);
        }
        if (!period_names.includes(model.currentPeriodTypeTo)) {
          period_names.push(model.currentPeriodTypeTo);
        }
        period_names = period_names.length ? ["="].concat(period_names.sort()): undefined;
        periods = periods.length ? ["="].concat(periods.sort()): undefined;
        scenarios = scenarios.length ? ["="].concat(scenarios.sort()): undefined;
        this._datePickerService.getKoobDataByCfg({
          with: 'luxmsbi.bef',
          columns: ['value', 'ch_jsonb'],
          filters: {
            ...filters,
            do_name: ['=', 489],
            period_name: period_names,
            period: periods,
            scenario: scenarios
          }
        }).then(data => {
          const startVal = data?.length ? data[0]?.value : 0;
          const finishVal = data?.length > 1? data[1]?.value : 0;
          this.setState({periodStart: startVal, periodFinish: finishVal, data: data.map(el => Object.keys(el.ch_jsonb).map(key => el.ch_jsonb[key]))});
        });
      }
      public componentWillUnmount(): void {
        // this._datePickerService.unsubscribe(this._onSvcUpdated);
        // this._datePickerService = null;
      }
      public onSetupContainer = (container, data) => {
        if (data.length && container) {
          let config = {
            grid: {
              show: false,
              right: 0,
            },
            xAxis: {
              axisTick: {
                show: false
              },
              splitLine: {
                show: false
              },
              axisLine: {
                show: false
              },
              axisLabel: {
                show: false
              },
              type: 'category',
            },
            yAxis: {
              axisTick: {
                show: false
              },
              axisLabel: {
                show: false
              },
              splitLine: {
                show: false
              },
              axisLine: {
                show: false
              },
              type: 'value'
            },
            series: data.map((el, i) => ({
              data: el.map((elem, j) => ({value: elem, symbolSize: j != el.length - 1 ? 0 : 4})),
              itemStyle: {
                color: i == 0 ? "#0070BA" : "#2FB4E9"
              },
              type: 'line',
              smooth: true
            })),
          };
          if (this._chart) {
            this._chart.clear();
            this._chart.setOption(config);
          } else {
            this._chart = echarts.init(container, null, {renderer: 'svg'});
            this._chart.setOption(config);
          }
        }
      }
      public render() {
        const {cfg} = this.props;
        const {periodStart, periodFinish, data} = this.state;
        const info = cfg.getRaw().info || {title: "", unit: "", icon: ""};
        const delta = periodFinish - periodStart;
        const deltaPercent = periodStart != 0 ? Math.round((delta)*100/Number(periodStart)) : 0;
        return (
          <div className="TwoLines">
            <div className="TwoLines__graphicBlock">
              <div className="TwoLines__graphicBlock__valueBlock">
                <div className="TwoLines__graphicBlock__icon">
                  {/* <SVGIcon path={info.icon ? `srv/resources/ds_res/${info.icon}` : ''}/> */}
                </div>
                <div className="TwoLines__graphicBlock__titleBlock">
                  <div className="TwoLines__graphicBlock__title">{info?.title}</div>
                  <div className="TwoLines__graphicBlock__text">
                    <div className={cn("TwoLines__graphicBlock__value", {positive: delta > 0, negative: delta <= 0})}>{`${delta > 0 ? '+' : ''}${delta != 0 ? formatNumberWithString(delta, "-# ###") : 0}`}</div>
                    <div className="TwoLines__graphicBlock__unit">{info?.unit}</div>
                  </div>
                </div>
              </div>
              <div className="TwoLines__graphicBlock__graph" ref={(el) => this.onSetupContainer(el, data)}></div>
            </div>
            <div className="TwoLines__info">
              <div className="TwoLines__item">
                <div className="TwoLines__info__title">{this._datePickerService?.getTitle('from')}</div>
                <div className="TwoLines__info__text">
                  <div className="TwoLines__info__value TwoLines__info__value--first">{formatNumberWithString(periodStart, "-# ###")}</div>
                  <div className="TwoLines__info__unit">{info?.unit}</div>
                </div>
              </div>
              <div className="TwoLines__item">
                <div className="TwoLines__info__title">{this._datePickerService?.getTitle('to')}</div>
                <div className="TwoLines__info__text">
                  <div className="TwoLines__info__value TwoLines__info__value--second">{formatNumberWithString(periodFinish, "-# ###")}</div>
                  <div className="TwoLines__info__unit">{info?.unit}</div>
                </div>
              </div>
              <div className="TwoLines__item">
                <div className="TwoLines__info__text">
                  <div className={cn("TwoLines__info__value", {positive: delta > 0, negative: delta <= 0})}>{`${deltaPercent > 0 ? '+' : ''}${formatNumberWithString(deltaPercent,"-# ###,#")}%`}</div>
                </div>
              </div>
            </div>
          </div>
        );
      }
}
