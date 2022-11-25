import {AppConfig, BaseService, createObjectsCache, createSingleton, UrlState} from 'bi-internal/core';
import { throttle } from 'lodash';
import { uniq } from 'lodash/fp';
import axios from "axios";
import {IObservable} from "bi-internal/defs/Observable";

const throttleTimeout = 3000;                                                                       // можно ставить достаточно большим
                                                                                                    // повторные фильтры будут срабатывать в течение этого времени
export interface IDatePickerModel{
  loading?: boolean;
  error?: string;
  data: any;
  period_names_dict: any;
  periods_dict: any;
  scenarios_dict: any;
  currentPeriodTypeFrom: number;
  currentPeriodTypeTo: number;
  currentYearFrom: string;
  currentYearTo: string;
  currentPeriodFrom: number[];
  currentPeriodTo: number[];
  currentScenarioFrom: number;
  currentScenarioTo: number;
}
export const PERIODTYPES = {
  '1': 'Год',
  '2': 'Квартал',
  '3': 'Месяц'
};
export const PERIODS = {
  year: {name: 'Год', id: '1'},
  quarter: {name: 'Квартал', id: '2'},
  month: {name: 'Месяц', id: '3'}
};
export const QUARTERS = {
  Q1: 'I квартал',
  Q2: 'II квартал',
  Q3: 'III квартал',
  Q4: 'IV квартал'
}
export const QUARTERS_INDEXES = {
  'I': 0,
  'II': 3,
  'III': 6,
  'IV': 9
}
export const MONTHS = {
  '01': 'Январь',
  '02': 'Февраль',
  '03': 'Март',
  '04': 'Апрель',
  '05': 'Май',
  '06': 'Июнь',
  '07': 'Июль',
  '08': 'Август',
  '09': 'Сентябрь',
  '10': 'Октябрь',
  '11': 'Ноябрь',
  '12': 'Декабрь',
}
export const MONTHS_INDEXES = {
  'Январь': 0,
  'Февраль': 1,
  'Март': 2,
  'Апрель': 3,
  'Май': 4,
  'Июнь': 5,
  'Июль': 6,
  'Август': 7,
  'Сентябрь': 8,
  'Октябрь': 9,
  'Ноябрь': 10,
  'Декабрь': 11,
}

export const SCENARIOS = {
  '1': 'Бизнес-план',
  '2': 'Прогноз 1+11',
  '3': 'Прогноз 2+10',
  '4': 'Прогноз 3+9',
  '5': 'Прогноз 4+8',
  '6': 'Прогноз 5+7',
  '7': 'Прогноз 6+6',
  '8': 'Прогноз 7+5',
  '9': 'Прогноз 8+4',
  '10': 'Прогноз 9+3',
  '11': 'Прогноз 10+2',
  '12': 'Прогноз 11+1',
  '13': 'Факт',
  '14': 'Прогноз'
}
export class DatePickerService extends BaseService<IDatePickerModel> {
  private readonly id: string | number;
  //private constructor() {
  private constructor(koobId: string) {
    super({
      loading: false,
      error: null,
      data: [],
      koob: koobId,
      dimensions: ['period_name', 'period', 'scenario'],
      period_names_dict: [],
      periods_dict: [],
      scenarios_dict: [],
      currentPeriodTypeFrom: 1,
      currentPeriodTypeTo: 1,
      currentYearFrom: 2021,
      currentYearTo: 2021,
      currentPeriodFrom: [205],
      currentPeriodTo: [205],
      currentScenarioFrom: 1,
      currentScenarioTo: 1
    });
    this.id = koobId;
    const currentDate = new Date();
    const currentDateYear = currentDate.getFullYear();
    const currentDateMonthIndex = currentDate.getMonth();
    Promise.all(this._model.dimensions.map(dim => fetch(`api/v3/koob/${this._model.koob}.${dim}`).then(resp => resp.json()))).then(responses => {
      const period_names_dict = responses.length ? responses[0].values : [];
      const periods_dict = responses.length > 1? responses[1].values : [];
      const scenarios_dict = responses.length > 2? responses[2].values : [];
      this.getKoobDataByCfg({with: this._model.koob, columns: this._model.dimensions, sort: ["+period_name", "+period", "+scenario"], distinct: []}).then(dataPeriods => {
        let data = [];
        dataPeriods?.map(dataElement => {
          let currentPeriodType = data.find(el => el.id == dataElement.period_name);
          const currentPeriodName_name = period_names_dict.find(el => el.id == dataElement.period_name) || "";
          const currentPeriod_name = periods_dict.find(el => el.id == dataElement.period) || "";
          const currentScenario_name = scenarios_dict.find(el => el.id == dataElement.scenario) || "";
          const currentYear = dataElement.period_name == 1 ? currentPeriod_name.title : currentPeriod_name.title.split('_')[1];
          const periodSplitted = currentPeriod_name.title.split('_');
          if (!currentPeriodType) {
            // Такого типа периода нет - создаем узел дерева;
            let newPeriodType = {
              id: dataElement.period_name,
              title: currentPeriodName_name.title,
              years: [currentYear],
              elements: []
            };
            let newChild = {
              year: currentYear,
              title: dataElement.period_name == 1 ? currentScenario_name.title : ( dataElement.period_name == 2 ? QUARTERS[periodSplitted[0]] : MONTHS[periodSplitted[0]]),
              period: dataElement.period,
              scenario: dataElement.scenario
            }
            newPeriodType.elements.push(newChild);
            data.push(newPeriodType);
          } else {
            let newChild = {
              year: currentYear,
              title: dataElement.period_name == 1 ? currentScenario_name.title : ( dataElement.period_name == 2 ? QUARTERS[periodSplitted[0]] : MONTHS[periodSplitted[0]]),
              period: dataElement.period,
              scenario: dataElement.scenario
            }
            if (dataElement.period_name == 1) {
              currentPeriodType.elements.push(newChild);
            } else {
              const currentElement = currentPeriodType.elements.find(el => el.year == newChild.year && el.title == newChild.title);
              if (!currentElement) {
                currentPeriodType.elements.push(newChild);
              }
            }
            if (!currentPeriodType.years.includes(currentYear)) {
              currentPeriodType.years.push(currentYear);
            }
          }
        });
        const years = data.find(el => el.id == 1).years || [];
        const currentYearFrom = years.includes(currentDateYear) ? currentDateYear : years[0];
        const currentYearTo = years.includes(currentDateYear) ? currentDateYear : years[years.length - 1];
        const currentScenarioFrom = 1;
        const currentMonthIndex = Number(currentDateMonthIndex) + 1;
        const currentPeriodFrom = uniq(data.find(el => el.id == 1).elements.filter(el => el.scenario == 1 && el.year == currentYearFrom).map(el => el.period));
        const currentPeriodTo = uniq(data.find(el => el.id == 1).elements.filter(el => el.scenario == currentMonthIndex && el.year == currentYearTo).map(el => el.period));
        this._updateWithData({period_names_dict: period_names_dict, periods_dict: periods_dict, scenarios_dict: scenarios_dict, data, currentYearFrom, currentYearTo, currentPeriodFrom, currentPeriodTo, currentScenarioFrom, currentScenarioTo: currentMonthIndex});
      });
    });
  }
  public async getKoobDataByCfg(cfg): Promise<any> {
    const url: string = AppConfig.fixRequestUrl(`/api/v3/koob/data`);
    const columns = cfg.columns;

    let filters = {};
    if (cfg.filters) filters = {...cfg.filters};

    const body: any = {
      with: cfg.with,
      columns,
      filters,
    };

    if (cfg.offset) body.offset = cfg.offset;
    if (cfg.limit) body.limit = cfg.limit;
    if (cfg.sort) body.sort = cfg.sort;
    if (cfg.options) body.options = cfg.options;
    if (cfg.subtotals?.length) body.subtotals = cfg.subtotals;

    if (cfg.distinct) {                                                                           // если нет measures, то лучше применить distinct
      body.distinct = [];
    }

    // test
    // body.limit = 2;

    try {
      const response = await axios({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/stream+json',
        },
        data: body,
        cancelToken: cfg.cancelToken,
      });

      let data = response.data;

      if (String(response.headers['content-type']).startsWith('application/stream+json')) {
        if (typeof data === 'string') {
          data = data.split('\n').filter((line: string) => !!line).map((line: string) => JSON.parse(line));
        } else if (data && (typeof data === 'object') && !Array.isArray(data)) {
          data = [data];
        }
      }

      return data;

    } catch (e) {
      return '';
    }
  }
  public getBranchTitleById(type, id, position = 'from') {
    let {data, currentPeriodTypeFrom, currentPeriodTypeTo, currentYearFrom, currentYearTo} = this._model;
    let title = "";
    switch(type) {
      case 'period_name':
        title = data.length ? data.find(el => el.id == id)?.title: "";
        break;
      case 'year':
        title = data.length ? data.find(el => el.id == (position == 'from' ? currentPeriodTypeFrom : currentPeriodTypeTo))?.elements.find(el => el.year == id)?.year : "";
        break;
      case 'period':
      case 'scenario':
        title = data.length ? data.find(el => el.id == (position == 'from' ? currentPeriodTypeFrom : currentPeriodTypeTo))?.elements.find(el => el[type] == id)?.title: "";
        break;
    }
    return title;
  }
  public getMonthIndexByTitle(title) {
    let monthIndex = 0;
    if (title.indexOf("Бизнес-план") != -1) {
      monthIndex = 0;
    } else if (title.indexOf("Факт") != -1) {
      monthIndex = 11;
    } else if (title.indexOf("Прогноз") != -1) {
        monthIndex = Number(title.split(" ")[2].split("+")[0]) - 1;
    } else if (title.indexOf("квартал") != -1) {
      monthIndex = QUARTERS_INDEXES[title.split(" ")[1]];
    } else {
      monthIndex = MONTHS_INDEXES[title];
    }
    return monthIndex;
  }
  public getTitle(position = 'from') {
    const {data,currentPeriodTypeFrom, currentPeriodTypeTo, currentYearFrom, currentYearTo, currentPeriodFrom, currentPeriodTo, currentScenarioFrom, currentScenarioTo} = this._model;
    const currentPeriodType = position == 'from' ? currentPeriodTypeFrom : currentPeriodTypeTo;
    const currentYear = position == 'from' ? currentYearFrom : currentYearTo;
    const currentPeriodIds = position == 'from' ? currentPeriodFrom : currentPeriodTo;
    const currentScenario = position == 'from' ? currentScenarioFrom : currentScenarioTo;
    let titles = data.find(el => el.id == currentPeriodType)?.elements.filter(el => String(el.year) == String(currentYear) && currentPeriodIds.includes(el.period)) || [];
    if (currentPeriodType == 1) {
      titles = titles?.filter(el => el.scenario == currentScenario)
    }
    const currentPeriodElementsTitles = titles?.filter(el => el.title).map(el => el.title);

    return `${this.getBranchTitleById('year', currentYear, position)} ${currentPeriodType == 1 ? titles?.[0]?.title: (currentPeriodElementsTitles.length == 1 ? currentPeriodElementsTitles[0] : `${position == 'from' ? 'Базовый период': 'Отчетный период'}`)}`;
  }
  public setFilter(currentPeriodTypeFrom, currentPeriodTypeTo, currentYearFrom, currentYearTo, currentPeriodFrom, currentPeriodTo, currentScenarioFrom, currentScenarioTo) {
    this._updateWithData({currentPeriodTypeFrom, currentPeriodTypeTo, currentYearFrom, currentYearTo, currentPeriodFrom, currentPeriodTo, currentScenarioFrom, currentScenarioTo});
  }
  protected _dispose() {
    if (window.__datePickerService && window.__datePickerService[String(this.id)]) {
      delete window.__datePickerService[String(this.id)];
    }
    super._dispose();
  }
  public static createInstance (id: string | number) : DatePickerService {
    if (!(window.__datePickerService)) {
      window.__datePickerService = {};
    }
    if (!window.__datePickerService.hasOwnProperty(String(id))) {
      window.__datePickerService[String(id)] = new DatePickerService(String(id));
    }
    return window.__datePickerService[String(id)];
  };
}
