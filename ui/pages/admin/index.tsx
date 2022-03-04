import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Switch,
  Textarea,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { ErrorMessage } from "@hookform/error-message";
import InlineFormControl from "components/inlineformcontrol";
import Loading from "components/loading";
import Right from "components/right";
import ReactECharts from "echarts-for-react";
import useMessage from "lib/useMessage";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import Area from "../../components/area";
import { api } from "../../lib/api";
import useConfig, { Config } from "../../lib/api/admin/config";
import useScoreboard from "../../lib/api/scoreboard";
import { dateFormat, parseDateString } from "../../lib/date";

type ConfigParams = {
  start_at: string;
  end_at: string;
  ctf_open: boolean;
  register_open: boolean;
  lock_second: number;
  lock_count: number;
  lock_duration: number;
  score_expr: string;
};

type ScoreEmulateResponse = number[];

interface AdminConfigImplProps {
  data: Config;
}

const AdminConfigImpl = ({ data }: AdminConfigImplProps) => {
  const { mutate } = useConfig();
  const { start_at: _start_at, end_at: _end_at, ..._data } = data;
  const { data: scoreboard } = useScoreboard();

  const params: ConfigParams = {
    start_at: dateFormat(data.start_at),
    end_at: dateFormat(data.end_at),
    ..._data,
  };

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ConfigParams>({ defaultValues: params });

  const { message, error } = useMessage();

  const onSubmit = async (data: ConfigParams) => {
    const { start_at, end_at, ..._data } = data;
    const newConfig = {
      start_at: parseDateString(data.start_at),
      end_at: parseDateString(data.end_at),
      ..._data,
    };

    try {
      const res = await api.post("/admin/set-config", newConfig);
      message(res);
      mutate();
    } catch (e) {
      error(e);
    }
  };

  // スコア遷移グラフまわり
  const [scoreGraph, setScoreGraph] = useState<number[]>([]);
  const [numberOfSolves, setNumberOfSolves] = useState(200);
  const scoreEmulate = () => {
    api
      .get<ScoreEmulateResponse>("/admin/score-emulate", {
        params: {
          maxCount: numberOfSolves,
          expr: getValues("score_expr"),
        },
      })
      .then((r) => {
        setScoreGraph(r.data);
      });
  };

  const getScoreboard = () => {
    const link = document.createElement("a");
    link.href =
      "data:applicaion/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(scoreboard));
    link.download = "scoreboard.json";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 1000);
  };

  // score seriesを全部再計算する恐怖のメソッド
  const recalc = async () => {
    try {
      const res = await api.post("/admin/recalc-series");
      message(res);
    } catch (e) {
      error(e);
    }
  };

  return (
    <Stack w="lg" mx="auto" mt="10">
      <form onSubmit={handleSubmit(onSubmit)}>
        <ErrorMessage errors={errors} name="Error" />
        <InlineFormControl isInvalid={errors.start_at !== undefined}>
          <FormLabel htmlFor="start_at">CTF Starts at</FormLabel>
          <Input
            id="start_at"
            {...register("start_at", {
              required: true,
              validate: (value: string) => parseDateString(value) !== null,
            })}
          ></Input>
        </InlineFormControl>

        <InlineFormControl isInvalid={errors.end_at !== undefined}>
          <FormLabel htmlFor="end_at">CTF Ends at</FormLabel>
          <Input
            id="end_at"
            {...register("end_at", {
              required: true,
              validate: (value: string) => parseDateString(value) !== null,
            })}
          ></Input>
        </InlineFormControl>

        <InlineFormControl isInvalid={errors.ctf_open !== undefined}>
          <FormLabel htmlFor="ctf_open">CTF is open</FormLabel>
          <Switch id="ctf_open" {...register("ctf_open")} />
        </InlineFormControl>

        <InlineFormControl isInvalid={errors.register_open !== undefined}>
          <FormLabel htmlFor="register_open">Registration is open</FormLabel>
          <Switch id="register_open" {...register("register_open")} />
        </InlineFormControl>

        <Box>
          Submission is locked for
          <Input w="2em" type="number" {...register("lock_second")} /> seconds
          when
          <Input w="2em" type="number" {...register("lock_count")} /> wrong
          flags submitted in
          <Input w="2em" type="number" {...register("lock_duration")} />{" "}
          seconds.
        </Box>

        <FormControl mt={5}>
          <FormLabel htmlFor="score_expr">Score Expr</FormLabel>
          <Textarea {...register("score_expr")} />
        </FormControl>

        <Area>
          <InlineFormControl>
            <FormLabel htmlFor="end_at">Max Solves</FormLabel>
            <Input
              value={numberOfSolves}
              onChange={(e) => setNumberOfSolves(Number(e.target.value))}
            />
          </InlineFormControl>
          <Right>
            <Button onClick={scoreEmulate}>Draw Graph</Button>
          </Right>
          <ReactECharts
            style={{ flex: 1 }}
            option={{
              tooltip: {
                trigger: "axis",
              },
              xAxis: {
                name: "number of solves",
                nameLocation: "center",
                type: "category",
                data: scoreGraph.map((_, i) => i),
              },
              yAxis: {
                name: "score",
                type: "value",
              },
              series: [
                {
                  data: scoreGraph,
                  type: "line",
                },
              ],
            }}
          />
        </Area>

        <FormControl>
          <Right>
            <Button type="submit">Apply Changes</Button>
          </Right>
        </FormControl>
      </form>

      <Divider />

      <Wrap>
        <WrapItem>
          <Button
            onClick={() => {
              getScoreboard();
            }}
          >
            Scoreboard for CTFtime
          </Button>
        </WrapItem>

        <WrapItem>
          <Button onClick={() => {}}>Scoreboard for CTF-ratings</Button>
        </WrapItem>

        <WrapItem>
          <Button
            onClick={() => {
              recalc();
            }}
          >
            Recalc All Score Series
          </Button>
        </WrapItem>
      </Wrap>
    </Stack>
  );
};

const AdminConfig = () => {
  const { data } = useConfig();

  if (!data) {
    return <Loading />;
  }
  return <AdminConfigImpl data={data} />;
};

export default AdminConfig;